export function axialResistance({ areaMm2, sigmaCu, sigmaCe, alpha, shortTerm = false }) {
  const area = Number(areaMm2);
  const cu = Number(sigmaCu);
  const ce = Number(sigmaCe);
  const a = Number(alpha);
  if (![area, cu, ce, a].every(Number.isFinite) || area <= 0 || a <= 0) {
    throw new Error('Thông số đầu vào chưa hợp lệ.');
  }
  const stress = cu / a - ce / 4; // MPa = N/mm²
  const longTermKn = stress * area / 1000;
  return {
    stress,
    longTermKn,
    shortTermKn: longTermKn * 2,
    valueKn: shortTerm ? longTermKn * 2 : longTermKn
  };
}

export const tcvn7888Checklist = [
  'Chứng chỉ xi măng và vật liệu sản xuất bê tông',
  'Chứng chỉ cốt liệu lớn, cốt liệu nhỏ',
  'Chứng chỉ chất lượng thép chủ, thép tấm, thép đai',
  'Chứng chỉ nước và phụ gia (nếu có)',
  'Chứng chỉ đánh giá chất lượng bê tông cọc',
  'Biên bản kiểm tra ngoại quan, kích thước và khuyết tật',
  'Hình ảnh trước sửa chữa đối với khuyết tật trong phạm vi cho phép (nếu có)',
  'Chứng chỉ thử độ bền uốn nứt thân cọc',
  'Kết quả các thí nghiệm độ bền bổ sung khi thiết kế/đơn hàng yêu cầu',
  'Biên bản nghiệm thu xuất xưởng giữa nhà sản xuất và khách hàng'
];
