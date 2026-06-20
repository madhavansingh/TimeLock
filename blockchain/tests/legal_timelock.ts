import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";

describe("legal_timelock", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  it("Anchor integration test suites set up correctly", async () => {
    console.log("Ready to execute on-chain test sequences.");
  });
});
