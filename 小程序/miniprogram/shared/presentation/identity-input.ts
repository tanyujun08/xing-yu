export class IdentityInputError extends Error {
  constructor(readonly field: 'realName' | 'identityNumber', message: string) { super(message); }
}
export function identityInput(realName: string, identityNumber: string): { real_name: string; identity_number: string } {
  const name = realName.trim();
  const number = identityNumber.trim().toUpperCase();
  if ([...name].length < 2 || [...name].length > 50 || [...name].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) throw new IdentityInputError('realName', '请输入 2–50 个字符的真实姓名');
  if (!/^[1-9]\d{16}[0-9X]$/.test(number)) throw new IdentityInputError('identityNumber', '请输入有效的 18 位身份证号');
  const year = Number(number.slice(6, 10)), month = Number(number.slice(10, 12)), day = Number(number.slice(12, 14));
  const birth = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || birth.getUTCFullYear() !== year || birth.getUTCMonth() !== month - 1 || birth.getUTCDate() !== day || birth.getTime() > Date.now()) throw new IdentityInputError('identityNumber', '身份证出生日期无效');
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const sum = weights.reduce((total, weight, index) => total + Number(number[index]) * weight, 0);
  if ('10X98765432'[sum % 11] !== number[17]) throw new IdentityInputError('identityNumber', '身份证校验位不正确，请检查号码');
  return { real_name: name, identity_number: number };
}
