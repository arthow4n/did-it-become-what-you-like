import { useActor } from "@xstate/react";
import { ScanLine } from "lucide-react";
import Big from "big.js";
import React from "react";
import { z } from "zod";
import { setup } from "xstate";

export const proofSchema = z.object({
  amount: z.string(),
  currency: z.string().length(3),
});

export const proofAmount = new Big("0.1").plus("0.2").toString();

const machineSetup = setup({
  types: {
    context: {} as { count: number },
    events: {} as { type: "increment" },
  },
});

export const proofMachine = machineSetup.createMachine({
  id: "toolchain-proof",
  initial: "ready",
  context: { count: 0 },
  states: {
    ready: {
      on: {
        increment: {
          actions: machineSetup.assign({
            count: ({ context }) => context.count + 1,
          }),
        },
      },
    },
  },
});

export function ToolchainProof(): React.JSX.Element {
  const [snapshot, send] = useActor(proofMachine);

  return (
    <button
      type="button"
      aria-label="Increment proof counter"
      onClick={() => send({ type: "increment" })}
    >
      <ScanLine aria-hidden="true" />
      Count {snapshot.context.count}
    </button>
  );
}
