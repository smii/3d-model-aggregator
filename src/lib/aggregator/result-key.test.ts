import { describe, expect, it } from "vitest";
import type { SourcePlatform } from "@/types/model";
import { resultKey } from "./result-key";

describe("resultKey", () => {
  it('formats a result as "<platform>:<id>"', () => {
    expect(resultKey({ sourcePlatform: "printables", id: "123" })).toBe("printables:123");
  });

  it.each<SourcePlatform>([
    "makerworld",
    "printables",
    "thingiverse",
    "cults3d",
    "thangs",
    "crealitycloud",
    "grabcad",
    "myminifactory",
  ])("prefixes the id with the platform name for %s", (platform) => {
    expect(resultKey({ sourcePlatform: platform, id: "42" })).toBe(`${platform}:42`);
  });

  it("gives the same id on two platforms two different keys", () => {
    const a = resultKey({ sourcePlatform: "printables", id: "1" });
    const b = resultKey({ sourcePlatform: "thingiverse", id: "1" });

    expect(a).not.toBe(b);
  });

  it("is stable: equal inputs give equal keys", () => {
    expect(resultKey({ sourcePlatform: "cults3d", id: "benchy-boat" })).toBe(
      resultKey({ sourcePlatform: "cults3d", id: "benchy-boat" }),
    );
  });

  it("accepts a full result and ignores its other fields", () => {
    const full = {
      id: "7",
      sourcePlatform: "grabcad" as const,
      title: "Anything",
      author: "someone",
    };

    expect(resultKey(full)).toBe("grabcad:7");
  });
});
