import { describe, expect, it } from "vitest";
import {
  addMonthsToMonthISO,
  formatDateOnly,
  formatDateTime,
  formatMonthLabel,
  getCurrentMonthISO,
  getTodayDateISO,
} from "@/lib/timezone";

describe("fuso horário de Brasília", () => {
  it("obtém a data civil de Brasília mesmo quando UTC já virou o dia seguinte", () => {
    expect(getTodayDateISO(new Date("2026-11-20T02:30:00.000Z"))).toBe("2026-11-19");
    expect(getCurrentMonthISO(new Date("2026-12-01T02:30:00.000Z"))).toBe("2026-11");
  });

  it("formata datas civis sem deslocá-las por fuso horário", () => {
    expect(formatDateOnly("2026-12-21")).toBe("21/12/2026");
  });

  it("formata instantes no horário de Brasília", () => {
    expect(formatDateTime("2026-11-20T02:30:00.000Z")).toBe("19/11/2026, 23:30");
  });

  it("calcula meses sem depender do fuso do servidor", () => {
    expect(addMonthsToMonthISO("2026-12", 1)).toBe("2027-01");
    expect(addMonthsToMonthISO("2027-01", -1)).toBe("2026-12");
    expect(formatMonthLabel("2026-12")).toBe("dezembro de 2026");
  });
});
