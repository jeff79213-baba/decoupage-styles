import { describe, it, expect } from 'vitest';
import { filterSelected, pageNext, pagePrev, progressPct, scoreResult, THEMES, themeVars } from './app-logic.js';

describe('filterSelected', () => {
  it('只回傳被選中的索引，升冪排序', () => {
    expect(filterSelected([0,1,2,3,4,5,6,7,8], [5,0,2])).toEqual([0,2,5]);
  });
  it('空的 selected 回傳空陣列', () => {
    expect(filterSelected([0,1,2], [])).toEqual([]);
  });
});

describe('pageNext / pagePrev', () => {
  it('pageNext 前進到下一章', () => {
    expect(pageNext(0, [0,2,4])).toBe(2);
  });
  it('pageNext 到底就停', () => {
    expect(pageNext(4, [0,2,4])).toBe(4);
  });
  it('pagePrev 回到上一章', () => {
    expect(pagePrev(4, [0,2,4])).toBe(2);
  });
  it('pagePrev 到頂就停', () => {
    expect(pagePrev(0, [0,2,4])).toBe(0);
  });
});

describe('progressPct', () => {
  it('計算已完成佔選取章節的百分比', () => {
    expect(progressPct([0,2,4], [0,2])).toBe(67);
  });
  it('全部完成為 100', () => {
    expect(progressPct([1,3], [1,3])).toBe(100);
  });
  it('選取為空則 0', () => {
    expect(progressPct([], [0])).toBe(0);
  });
});

describe('scoreResult', () => {
  it('全對是滿分', () => {
    expect(scoreResult(3,3)).toEqual({ pct:100, label:'滿分！' });
  });
  it('及格線 60', () => {
    expect(scoreResult(2,3)).toEqual({ pct:67, label:'及格' });
  });
  it('低於 60 是再練習', () => {
    expect(scoreResult(1,3)).toEqual({ pct:33, label:'再練習' });
  });
});

describe('THEMES / themeVars', () => {
  it('THEMES 含三種主題', () => {
    expect(Object.keys(THEMES).sort()).toEqual(['dark','fresh','green']);
  });
  it('themeVars 回傳指定主題變數', () => {
    expect(themeVars('dark')['--bg']).toBe('#0F172A');
  });
  it('themeVars 非法名稱回傳 green', () => {
    expect(themeVars('nope')['--bg']).toBe('#F1F5F2');
  });
});
