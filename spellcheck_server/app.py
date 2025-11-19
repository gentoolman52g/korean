from fastapi import FastAPI, Form
from fastapi.responses import JSONResponse
from py_hanspell_aideer import spell_checker

app = FastAPI(title="Korean Spellcheck Server (hanspell)")


@app.post("/check")
async def check_spelling(text: str = Form(...)):
  """
  한국어 맞춤법 검사 엔드포인트

  - 입력: form-urlencoded 의 text 필드
  - 출력: JSON { corrected: string }
  """
  try:
    result = spell_checker.check(text)
    corrected = result.checked

    return JSONResponse(
      {
        "corrected": corrected,
        "original": text,
        "result": {
          "errata_count": result.errors,
        },
      }
    )
  except Exception as e:
    # 외부 서비스 호출 실패 등: 원문을 그대로 반환
    return JSONResponse(
      {
        "corrected": text,
        "original": text,
        "error": str(e),
      },
      status_code=500,
    )


# 로컬 테스트용 실행 방법 (예시):
# uvicorn app:app --host 0.0.0.0 --port 5000


