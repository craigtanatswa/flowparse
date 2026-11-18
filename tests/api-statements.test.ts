import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiContext: vi.fn(),
  loadAccountData: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  getApiContext: mocks.getApiContext,
  jsonError: (message: string, status = 400) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "content-type": "application/json" },
    }),
  parseUuid: (value: string) => value,
  sanitizeFileName: (value: string) => value,
}));

vi.mock("@/lib/account", () => ({
  loadAccountData: mocks.loadAccountData,
}));

vi.mock("@/lib/log", () => ({
  logServerError: mocks.logServerError,
}));

import { DELETE } from "@/app/api/statements/[id]/route";
import { POST } from "@/app/api/statements/route";

const DOCUMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STORAGE_PATH = `user-1/${DOCUMENT_ID}/original.pdf`;

function fakeSupabase() {
  const remove = vi.fn().mockResolvedValue({ error: null });
  const createSignedUploadUrl = vi
    .fn()
    .mockResolvedValue({ data: { path: STORAGE_PATH, token: "upload-token" }, error: null });
  const rpc = vi.fn(async (name: string) => {
    if (name === "create_statement") {
      return {
        data: [{ id: DOCUMENT_ID, storage_path: STORAGE_PATH, file_name: "statement.pdf" }],
        error: null,
      };
    }
    if (name === "delete_statement") {
      return { data: STORAGE_PATH, error: null };
    }
    return { data: null, error: { message: "unexpected rpc" } };
  });
  const supabase = {
    rpc,
    storage: {
      from: () => ({ createSignedUploadUrl, remove }),
    },
  };
  return { supabase, rpc, createSignedUploadUrl, remove };
}

function account() {
  return {
    usageAvailable: true,
    usage: {
      pages_processed: 0,
      documents_uploaded: 0,
      conversions_completed: 0,
      conversions_failed: 0,
      storage_bytes: 0,
    },
    plan: {
      id: "free",
      name: "Free",
      description: "",
      priceDisplay: "$0",
      cadence: "forever",
      pageLimit: 3,
      unlimited: false,
      batchLimit: 1,
      fileSizeMb: 25,
      features: [],
    },
    profile: null,
    billing: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadAccountData.mockResolvedValue(account());
  mocks.getApiContext.mockResolvedValue({
    user: { id: "user-1" },
    supabase: fakeSupabase().supabase,
  });
});

describe("POST /api/statements", () => {
  it("requires a signed-in user", async () => {
    mocks.getApiContext.mockResolvedValue(null);
    const response = await POST(
      new Request("http://localhost/api/statements", {
        method: "POST",
        body: JSON.stringify({ fileName: "statement.pdf", fileSize: 1000 }),
      })
    );
    expect(response.status).toBe(401);
  });

  it("rejects malformed JSON and invalid file metadata", async () => {
    const malformed = await POST(
      new Request("http://localhost/api/statements", {
        method: "POST",
        body: "{not json",
      })
    );
    expect(malformed.status).toBe(400);

    const invalid = await POST(
      new Request("http://localhost/api/statements", {
        method: "POST",
        body: JSON.stringify({ fileName: "statement.txt", fileSize: 1000 }),
      })
    );
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error).toMatch(/PDF/i);
  });

  it("creates the row through the RPC and returns a signed upload", async () => {
    const { supabase, rpc } = fakeSupabase();
    mocks.getApiContext.mockResolvedValue({ user: { id: "user-1" }, supabase });

    const response = await POST(
      new Request("http://localhost/api/statements", {
        method: "POST",
        body: JSON.stringify({ fileName: "statement.pdf", fileSize: 1000 }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.statementId).toBe(DOCUMENT_ID);
    expect(body.token).toBe("upload-token");
    expect(rpc).toHaveBeenCalledWith("create_statement", {
      p_file_name: "statement.pdf",
      p_file_size: 1000,
    });
  });

  it("does not sign a URL when the RPC fails", async () => {
    const { supabase, rpc, createSignedUploadUrl } = fakeSupabase();
    rpc.mockResolvedValueOnce({ data: null, error: { message: "database down" } });
    mocks.getApiContext.mockResolvedValue({ user: { id: "user-1" }, supabase });

    const response = await POST(
      new Request("http://localhost/api/statements", {
        method: "POST",
        body: JSON.stringify({ fileName: "statement.pdf", fileSize: 1000 }),
      })
    );

    expect(response.status).toBe(500);
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("cleans up the row when signing the upload fails", async () => {
    const { supabase, rpc, createSignedUploadUrl } = fakeSupabase();
    createSignedUploadUrl.mockResolvedValueOnce({
      data: null,
      error: { message: "storage down" },
    });
    mocks.getApiContext.mockResolvedValue({ user: { id: "user-1" }, supabase });

    const response = await POST(
      new Request("http://localhost/api/statements", {
        method: "POST",
        body: JSON.stringify({ fileName: "statement.pdf", fileSize: 1000 }),
      })
    );

    expect(response.status).toBe(500);
    expect(rpc).toHaveBeenCalledWith("delete_statement", {
      p_document_id: DOCUMENT_ID,
    });
  });
});

describe("DELETE /api/statements/[id]", () => {
  const context = { params: Promise.resolve({ id: DOCUMENT_ID }) };

  it("requires a signed-in user", async () => {
    mocks.getApiContext.mockResolvedValue(null);
    const response = await DELETE(new Request("http://localhost"), context);
    expect(response.status).toBe(401);
  });

  it("returns 404 when the RPC cannot find an owned document", async () => {
    const { supabase, rpc } = fakeSupabase();
    rpc.mockResolvedValueOnce({ data: null, error: { message: "Document not found" } });
    mocks.getApiContext.mockResolvedValue({ user: { id: "user-1" }, supabase });

    const response = await DELETE(new Request("http://localhost"), context);
    expect(response.status).toBe(404);
  });

  it("deletes through the RPC and removes the stored object", async () => {
    const { supabase, rpc, remove } = fakeSupabase();
    mocks.getApiContext.mockResolvedValue({ user: { id: "user-1" }, supabase });

    const response = await DELETE(new Request("http://localhost"), context);

    expect(response.status).toBe(204);
    expect(rpc).toHaveBeenCalledWith("delete_statement", {
      p_document_id: DOCUMENT_ID,
    });
    expect(remove).toHaveBeenCalledWith([STORAGE_PATH]);
  });
});
