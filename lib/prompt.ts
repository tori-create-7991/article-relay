import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

/** プロンプトを表示してユーザー入力を読む。空入力は空文字を返す */
export async function ask(question: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(question);
    return answer.trim();
  } finally {
    rl.close();
  }
}

/** 入力が空でなくなるまで再質問する */
export async function askRequired(
  question: string,
  validator?: (s: string) => string | null
): Promise<string> {
  while (true) {
    const answer = await ask(question);
    if (!answer) {
      console.error("(空入力です)");
      continue;
    }
    if (validator) {
      const err = validator(answer);
      if (err) {
        console.error(`(${err})`);
        continue;
      }
    }
    return answer;
  }
}
