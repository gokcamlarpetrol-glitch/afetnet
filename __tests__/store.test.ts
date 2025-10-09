// Basic Jest test setup for AfetNet
test("basic math works", () => {
  expect(1 + 1).toBe(2);
});

test("string operations work", () => {
  const str = "AfetNet";
  expect(str).toContain("Afet");
  expect(str.length).toBe(7);
});

test("array operations work", () => {
  const arr = [1, 2, 3];
  expect(arr).toHaveLength(3);
  expect(arr).toContain(2);
});

test("object operations work", () => {
  const obj = { name: "AfetNet", version: "1.0.0" };
  expect(obj.name).toBe("AfetNet");
  expect(obj.version).toBe("1.0.0");
});
