"use client";

import { useState } from "react";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Box from "@mui/material/Box";
import { TodayView } from "./today-view";
import { RangeView } from "./range-view";

type TabId = "today" | "week" | "month";

export function DashboardTabs() {
  const [tab, setTab] = useState<TabId>("today");

  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_, v: TabId) => setTab(v)}
        aria-label="Dashboard range tabs"
        sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab value="today" label="Today" data-testid="tab-today" />
        <Tab value="week" label="This week" data-testid="tab-week" />
        <Tab value="month" label="This month" data-testid="tab-month" />
      </Tabs>

      <Box role="tabpanel" hidden={tab !== "today"}>
        {tab === "today" && <TodayView />}
      </Box>
      <Box role="tabpanel" hidden={tab !== "week"}>
        {tab === "week" && <RangeView range="week" />}
      </Box>
      <Box role="tabpanel" hidden={tab !== "month"}>
        {tab === "month" && <RangeView range="month" />}
      </Box>
    </Box>
  );
}
