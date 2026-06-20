import * as anchor from "@coral-xyz/anchor";

module.exports = async function (provider) {
  anchor.setProvider(provider);
  console.log("LTN Solana Program Migration: Deployment completed successfully.");
};
