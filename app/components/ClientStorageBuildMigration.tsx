"use client";

import { useEffect } from "react";
import { runClientStorageMigration } from "@/app/lib/clientBuildMigration";

type Props = {
  buildId: string;
};

export function ClientStorageBuildMigration({ buildId }: Props) {
  useEffect(() => {
    runClientStorageMigration(buildId);
  }, [buildId]);

  return null;
}
