import { collectAddresses, toNodes, type GraphNode } from "../src/grapher";
import { describe, expect, it } from "bun:test";

describe("collectAddresses", () => {
  it("extracts addresses from nested structures", () => {
    const input = {
      a: "0x1111111111111111111111111111111111111111",
      nested: {
        b: [
          "0x2222222222222222222222222222222222222222",
          { c: "0x3333333333333333333333333333333333333333" }
        ],
        receivedPermissions: {
          ignored: "0x4444444444444444444444444444444444444444"
        }
      }
    };

    const out = new Set<string>();
    collectAddresses(input, out);

    expect(out).toEqual(
      new Set([
        "0x1111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222",
        "0x3333333333333333333333333333333333333333"
      ])
    );
  });
});

describe("toNodes", () => {
  it("converts raw JSON to GraphNodes", () => {
    const raw = {
      entries: [
        {
          type: "Contract",
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          name: "Alpha",
          ref: { x: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }
        },
        {
          type: "EOA",
          address: "0xcccccccccccccccccccccccccccccccccccccccc"
        },
        {
          type: "Contract",
          address: "0xdddddddddddddddddddddddddddddddddddddddd",
          ref: ["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "0x0000000000000000000000000000000000000000"]
        }
      ]
    };

    const nodes = toNodes(raw);

    const expected: GraphNode[] = [
      {
        name: "Alpha",
        id: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        next: ["0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"]
      },
      {
        name: "0xdddddddddddddddddddddddddddddddddddddddd",
        id: "0xdddddddddddddddddddddddddddddddddddddddd",
        next: ["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]
      }
    ];

    expect(nodes).toEqual(expected);
  });
});
