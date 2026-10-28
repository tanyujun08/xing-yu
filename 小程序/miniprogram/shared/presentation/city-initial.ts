// First characters in the current 34-province region dataset. A new dataset
// must be checked against this index before it is used for city navigation.
const INITIAL_CHARACTERS: Record<string, string> = {
  A: '阿鞍安澳',
  B: '北保包巴本白蚌亳滨百毕宝博',
  C: '承沧长赤朝常滁池郴潮崇重成楚昌',
  D: '大丹东德儋达迪定',
  E: '鄂恩',
  F: '抚阜福佛防',
  G: '赣广桂贵甘果固高',
  H: '邯衡呼葫哈鹤黑淮杭湖合黄菏怀惠河贺海红汉和',
  J: '晋锦吉鸡佳嘉金景九济焦荆江揭酒基',
  K: '开昆克喀',
  L: '廊临吕辽连丽六龙聊洛漯娄柳来泸乐凉拉林兰陇',
  M: '牡马茂梅绵眉',
  N: '南宁内怒那',
  P: '盘莆萍平濮攀普',
  Q: '秦齐七衢泉青清钦黔曲庆',
  R: '日',
  S: '石朔沈四松双绥上苏宿绍三商省十随邵韶深汕遂山',
  T: '天唐太通铁泰台铜吐塔桃',
  W: '乌无温芜潍威武梧文渭吴',
  X: '邢忻兴锡徐宣厦新许信襄孝咸湘西香',
  Y: '阳运营延伊盐扬鹰宜烟岳益永云玉雅榆银',
  Z: '张镇舟漳淄枣郑周驻株珠湛肇中自资遵昭',
};

const initialByCharacter = new Map<string, string>();
for (const [initial, characters] of Object.entries(INITIAL_CHARACTERS)) {
  for (const character of characters) initialByCharacter.set(character, initial);
}

export function cityInitial(name: string): string {
  const first = name.trim().charAt(0);
  if (/^[a-z]$/i.test(first)) return first.toUpperCase();
  return initialByCharacter.get(first) ?? '#';
}
