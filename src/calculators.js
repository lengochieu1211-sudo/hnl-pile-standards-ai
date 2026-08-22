export function annulusAreaMm2({ diameterMm, thicknessMm }) {
  const D = Number(diameterMm);
  const t = Number(thicknessMm);
  if (![D, t].every(Number.isFinite) || D <= 0 || t <= 0 || 2 * t >= D) {
    throw new Error('Đường kính D và chiều dày t chưa hợp lệ.');
  }
  const d = D - 2 * t;
  return Math.PI / 4 * (D * D - d * d);
}

export function axialResistance({ areaMm2, sigmaCu, sigmaCe, alpha }) {
  const area = Number(areaMm2);
  const cu = Number(sigmaCu);
  const ce = Number(sigmaCe);
  const a = Number(alpha);
  if (![area, cu, ce, a].every(Number.isFinite) || area <= 0 || cu <= 0 || ce < 0 || a <= 0) {
    throw new Error('Thông số đầu vào chưa hợp lệ.');
  }
  const stress = cu / a - ce / 4;
  if (stress <= 0) throw new Error('Ứng suất tính ra không dương. Kiểm tra lại σcu, σce và α.');
  const longTermKn = stress * area / 1000;
  const shortTermKn = longTermKn * 2;
  return {
    stress,
    longTermKn,
    shortTermKn,
    recommendedMaxKn: shortTermKn * 0.8
  };
}

export const loadClassSigmaCe = { A: 4, AB: 6, B: 8, C: 10 };

export const tcvn7888Checklist = [
  'Chứng chỉ xi măng và vật liệu sản xuất bê tông',
  'Chứng chỉ cốt liệu lớn và cốt liệu nhỏ',
  'Chứng chỉ chất lượng thép chủ, thép tấm và thép đai',
  'Hồ sơ chất lượng nước và phụ gia (nếu có)',
  'Chứng chỉ đánh giá chất lượng bê tông cọc',
  'Chứng chỉ nghiệm thu ngoại quan, kích thước và khuyết tật',
  'Biên bản sửa chữa khuyết tật ngoại quan và ảnh trước sửa chữa (nếu có)',
  'Chứng chỉ kiểm tra độ bền uốn nứt thân cọc của lô sản phẩm',
  'Các chứng chỉ độ bền bổ sung khi thiết kế hoặc đơn hàng yêu cầu',
  'Biên bản nghiệm thu xuất xưởng giữa nhà sản xuất và khách hàng'
];
