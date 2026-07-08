# 약물사전

GitHub Pages에 그대로 올릴 수 있는 정적 사이트입니다. HTML, CSS, JavaScript만 사용하며 서버나 API 없이 브라우저 안에서 작동합니다.

## 핵심 기능

- 수액 속도 mL/hr 및 방울 간격
- 비례식 약물 계산기
- BSA, Mosteller 공식
- Cockcroft-Gault GFR 및 Carbo dose
- 약물명 별표 저장 및 내 약물카드 탭
- ICU 자료 iframe 탭

## 비례식 공식

```text
투여량(mL) = 처방용량(mg 환산) × 총부피(mL) ÷ 약물함량(mg 환산)
```

예:

```text
1000mg : 5mL = 150mg : x
x = 150 × 5 ÷ 1000 = 0.75mL
```

## 테스트 예시

- `1g/5mL` 약물에서 `150mg` 처방 → `0.75 mL`
- `500mg/10mL` 약물에서 `250mg` 처방 → `5 mL`
- `100mg/2mL` 약물에서 `25mg` 처방 → `0.5 mL`
- Cockcroft-Gault: `GFR = [(140-age) × BW / (72 × S-cr)] × 1(남성), 0.85(여성)`
- Carbo dose: `target AUC(2) × (GFR + 25)`
- 수액 속도: `gtt/min = (mL/hr × 20gtt/mL) ÷ 60`
- 방울 간격: `60 ÷ gtt/min`

## 파일 구조

- `index.html`
- `style.css`
- `script.js`

## 배포

이 폴더의 파일을 GitHub 저장소에 올린 뒤 GitHub Pages를 켜면 됩니다. 별도 빌드 과정은 필요하지 않습니다.

## ICU 자료

`ICU 자료` 탭은 `https://sch-icu.github.io/icu/`를 iframe으로 표시합니다. 탭을 누르면 다른 섹션을 숨기고 큰 화면으로 보여주며, iframe 영역은 하단 버튼이 잘리지 않도록 길게 확보했습니다. 현재 확인한 응답 헤더에는 iframe 삽입을 막는 `X-Frame-Options` 또는 `frame-ancestors` 설정이 없습니다.

## 약학정보원 검색 연결

약학정보원 검색은 `/searchDrug/search_total_result.asp?search_word=검색어&search_flag=all` 형식으로 결과 페이지를 엽니다. `검색` 버튼이나 입력창 Enter를 누르면 입력한 약물명을 `search_word` 파라미터에 넣어 약학정보원 검색 결과를 새 탭으로 엽니다.

확인 결과, 검색 결과 페이지는 로그인 없이 열립니다. 검색 결과의 제품 상세 링크는 약학정보원 페이지 안에서 `/searchDrug/result_drug.asp?drug_cd=...` 형식으로 연결됩니다.
