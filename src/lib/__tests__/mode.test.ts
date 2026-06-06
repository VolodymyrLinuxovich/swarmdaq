import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getExecMode } from "../mode";

describe("getExecMode", () => {
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
    delete process.env.SWARMDAQ_MODE;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it("returns SEEDED_DEMO when SWARMDAQ_MODE=SEEDED_DEMO", () => {
    process.env.SWARMDAQ_MODE = "SEEDED_DEMO";
    expect(getExecMode()).toBe("SEEDED_DEMO");
  });

  it("returns FALLBACK when SWARMDAQ_MODE=FALLBACK", () => {
    process.env.SWARMDAQ_MODE = "FALLBACK";
    expect(getExecMode()).toBe("FALLBACK");
  });

  it("returns FALLBACK when no API key is present", () => {
    expect(getExecMode()).toBe("FALLBACK");
  });

  it("returns LIVE when GOOGLE_GENERATIVE_AI_API_KEY is present", () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key-abc";
    expect(getExecMode()).toBe("LIVE");
  });

  it("returns LIVE when GEMINI_API_KEY is present", () => {
    process.env.GEMINI_API_KEY = "test-key-xyz";
    expect(getExecMode()).toBe("LIVE");
  });

  it("SEEDED_DEMO env takes priority over API key", () => {
    process.env.SWARMDAQ_MODE = "SEEDED_DEMO";
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "some-real-key";
    expect(getExecMode()).toBe("SEEDED_DEMO");
  });

  it("FALLBACK env takes priority over API key", () => {
    process.env.SWARMDAQ_MODE = "FALLBACK";
    process.env.GEMINI_API_KEY = "some-real-key";
    expect(getExecMode()).toBe("FALLBACK");
  });
});
