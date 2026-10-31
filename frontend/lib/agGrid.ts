"use client";

import { AllCommunityModule, ModuleRegistry, themeQuartz } from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

/** AG Grid theme tuned to the Snap-a-Store / PayPal palette. */
export const gridTheme = themeQuartz.withParams({
  accentColor: "#0070ba",
  fontFamily: "inherit",
  fontSize: 14,
  headerFontSize: 12,
  headerFontWeight: 700,
  headerTextColor: "#7a889c",
  headerBackgroundColor: "#fafbfd",
  foregroundColor: "#2c3e5b",
  borderColor: "#e7edf4",
  rowBorder: { color: "#edf1f5" },
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  spacing: 7,
  oddRowBackgroundColor: "#ffffff",
  rowHoverColor: "#f5f9ff",
  selectedRowBackgroundColor: "#eaf4ff",
  inputFocusBorder: { color: "#0070ba" },
});
