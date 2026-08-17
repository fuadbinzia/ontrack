/** Android react-native-svg PathParser aborts on empty / whitespace `d`. */
export function isDrawableSvgPath(
  value: string | undefined | null,
): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
