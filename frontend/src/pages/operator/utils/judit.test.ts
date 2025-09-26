import { describe, expect, it } from "vitest";

import { parseResponseDataFromResult } from "./judit";

describe("parseResponseDataFromResult", () => {
  it("fallbacks to root payload metadata when response_data is missing", () => {
    const payload = {
      numero_processo: "123",
      status: "Ativo",
      fonte: "Judit",
    };

    const parsed = parseResponseDataFromResult(payload);

    expect(parsed).not.toBeNull();
    expect(parsed?.raw).toEqual(payload);
    expect(parsed?.metadata).toMatchObject({
      numero_processo: "123",
      status: "Ativo",
      fonte: "Judit",
    });
  });
});
