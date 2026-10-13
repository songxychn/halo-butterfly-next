/** Map explicit Next values to the preserved Butterfly shrink behavior. */
export function resolveCodeShrink(value: unknown) {
  return value === 'collapsed' ? 'true' : value === 'disabled' ? 'none' : 'false';
}
