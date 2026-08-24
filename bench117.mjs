import {solveEngineeringQuestion} from './src/engineering-router.js';
const qs={
'end-bearing':'cọc chống A=0.16 m2 qb=5000 kPa gamma_c=1',
'driven':'tính sức chịu tải cọc vuông cạnh 0.4 m dài 12 m đóng lớp 1: 0-4m sét IL=0.5; lớp 2: 4-12m sét IL=0.3 gammaK=1.4',
'bored':'cọc nhồi A=0.785 m2 u=3.14 m qb=1500 kPa sum_fh=800 kPa.m gamma_c=1 gamma_RR=1 gamma_Rf=0.8',
'screw':'cọc vít c1=50 gamma1=18 h1=10 m A=0.5 m2 alpha1=18 alpha2=9.2 u=1.8 m fi=30 kPa h=15 m d=0.6 m gamma_c=1 gamma_RR=0.8 gamma_Rf=0.7',
'static':'thử tải tĩnh Ru=1200 kN gamma_c=1 gamma_cg1=1.1',
'dynamic':'thử động sa=0.003 m A=0.16 m2 eta=1500 M=1 Ed=45 kJ m1=3 T m2=2 T m3=0 T eps2=0.2',
'cpt':'CPT A=0.16 m2 u=1.6 m h=12 m qs=5000 kPa fs=50 kPa beta1=0.5 beta2=0.5',
'spt':'SPT qb=1000 kPa A=0.16 m2 fs=20 kPa Ls=6 m fc=15 kPa Lc=6 m u=1.6 m',
'settlement-single':'lún cọc đơn N=1 MN G1=20 MPa G2=15 MPa L=20 m d=0.6 m v1=0.3 v2=0.3 EA=10000 MN',
'settlement-group':'lún nhóm cọc s_single=0.01 m G1=20 MPa G2=20 MPa L=20 m v1=0.3 v2=0.3 a1=1.8 m N1=1 MN Li=20 m Lj=24 m kw0=50 MN/m Nu=100 MN m_corr=2',
'equivalent-block':'móng khối quy ước sef=0.015 m E1=20 MPa E2=30 MPa v2=0.3 p=200 kPa a=1.8 m d=0.6 m L=20 m E=30000 MPa A=0.283 m2 b=0.6 m',
'piled-raft':'móng bè-cọc IL=0.4 E=10 MPa loose_sand=0.5 m',
'construction-effect':'ảnh hưởng thi công kết cấu khung bê tông cốt thép đất sét IL=0.6 alpha=0.02 cm delta=10 Hz Rk=1200 kN tốc độ ép=3 m/min'
};
const out={}; for(const [k,q] of Object.entries(qs)){ const r=solveEngineeringQuestion(q); out[k]={q,workflow:r.workflow?.id,status:r.workflow?.status,result:r.result}; }
console.log(JSON.stringify(out,null,2));
