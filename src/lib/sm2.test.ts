import { describe, it, expect } from "vitest";
import { sm2, SM2State } from "./sm2";

const fresh: SM2State = { easeFactor: 2.5, interval: 0, repetitions: 0 };

describe("sm2", () => {
  describe("correct responses (quality >= 3)", () => {
    it("first correct review sets interval to 1 day", () => {
      const result = sm2(fresh, 5);
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(1);
    });

    it("second correct review sets interval to 6 days", () => {
      const after1 = sm2(fresh, 5);
      const result = sm2(after1, 5);
      expect(result.interval).toBe(6);
      expect(result.repetitions).toBe(2);
    });

    it("third correct review multiplies interval by ease factor", () => {
      const after1 = sm2(fresh, 5);
      const after2 = sm2(after1, 5);
      const result = sm2(after2, 5);
      // 6 * easeFactor (which has grown from 2.5 after two quality-5 reviews)
      expect(result.interval).toBeGreaterThan(6);
      expect(result.repetitions).toBe(3);
    });

    it("quality 3 (medium) still counts as correct", () => {
      const result = sm2(fresh, 3);
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(1);
    });
  });

  describe("incorrect responses (quality < 3)", () => {
    it("quality 0 resets repetitions and interval", () => {
      // Build up some progress first
      const after1 = sm2(fresh, 5);
      const after2 = sm2(after1, 5);
      expect(after2.repetitions).toBe(2);

      const result = sm2(after2, 0);
      expect(result.repetitions).toBe(0);
      expect(result.interval).toBe(1);
    });

    it("quality 2 also resets (boundary case)", () => {
      const after1 = sm2(fresh, 5);
      const result = sm2(after1, 2);
      expect(result.repetitions).toBe(0);
      expect(result.interval).toBe(1);
    });
  });

  describe("ease factor", () => {
    it("never drops below 1.3", () => {
      let state: SM2State = fresh;
      // Repeatedly fail to drive ease factor down
      for (let i = 0; i < 20; i++) {
        state = sm2(state, 0);
      }
      expect(state.easeFactor).toBe(1.3);
    });

    it("increases with high quality responses", () => {
      const result = sm2(fresh, 5);
      expect(result.easeFactor).toBeGreaterThan(2.5);
    });

    it("decreases with low quality responses", () => {
      const result = sm2(fresh, 0);
      expect(result.easeFactor).toBeLessThan(2.5);
    });
  });

  describe("nextReview date", () => {
    it("returns a date in the future", () => {
      const now = new Date();
      const result = sm2(fresh, 5);
      expect(result.nextReview.getTime()).toBeGreaterThan(now.getTime());
    });

    it("schedules 1 day out after first correct review", () => {
      const now = new Date();
      const result = sm2(fresh, 5);
      const diffMs = result.nextReview.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      // Should be ~1 day (within a few seconds tolerance)
      expect(diffDays).toBeGreaterThan(0.99);
      expect(diffDays).toBeLessThan(1.01);
    });
  });
});
