module.exports = async (input) => {
  const a = Number(input.a);
  const b = Number(input.b);

  if (Number.isNaN(a) || Number.isNaN(b)) {
    throw new Error('Inputs a and b must be numbers.');
  }

  return { sum: a + b };
};
