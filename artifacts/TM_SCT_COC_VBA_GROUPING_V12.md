# TM SCT Coc VBA Reverse Engineering — v12

## NhomCoc exact source behavior
`NhomCoc(SLCoc, A1, A2)` is VBA in `A_Function`, not DceSteel XLL.

- 1 -> `A1 & 1 & A2`
- 2..5 -> `A1 & "2 - 5" & A2`
- 6..10 -> `A1 & "6 - 10" & A2`
- 11..20 -> `A1 & "11 - 20" & A2`
- >20 -> `A1 & ">20" & A2`
- zero/negative and the numeric gap 1<n<2 leave the VBA function empty.

For TM SCT Coc, A1=`Đài ` and A2=` cọc`.

## Proximity macro
`DoTimSoLuongCocGanNhau`:
1. uses `P1` as `kccoc`; if P1=0, uses 3.1.
2. threshold = `kccoc * H(row)` using the STARTING pile diameter.
3. recursively traverses points whose Euclidean coordinate distance <= threshold.
4. uniqueness is by point name `C`, held in a VBA Collection.
5. writes `TenCoc.Count` to column A.

This is transitive connected-component behavior, but the fixed threshold comes from the starting row. Therefore unequal pile diameters can produce asymmetric group counts depending on which pile starts the traversal. HNL tags this as `DCE_HEURISTIC_REFERENCE`, not a TCVN numeric rule.

## Current workbook fixture
P1=3.5 and H=250 mm -> threshold=875 mm.
Expected if the macro runs:
- rows 20..23: groupCount=1.
- rows 24..38: five separate 3-pile clusters; each row sees groupCount=3.

The saved workbook cache instead has A20:A38=1 from the Q:U VLOOKUP and J20:J38=`Đài 1 cọc`, showing that `DienLaiHamVlookupCotA`/saved formula mode is currently reflected in cache rather than the proximity macro result.

## Numeric dependency
A/J grouping does not feed K/L/M:
- K=Rd/gammaN
- L=K/F
- M=OK/NOT OK

Therefore the DCE grouping macro is isolated from the imported compression-capacity decision.
