export const calculateRunningAverage = (oldAverage, oldCount, newValue) => {
  if (oldCount === 0) return newValue;
  return ((oldAverage * oldCount) + newValue) / (oldCount + 1);
};