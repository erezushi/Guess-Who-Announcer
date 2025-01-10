import { UPSTASH_ACCESS_TOKEN } from './config.js';

const UPSTASH_URL = 'https://square-reindeer-53414.upstash.io';

let startMessage = '';
let guessTimeout = null;

const capitalizeFirst = (string) => {
  return `${string[0].toUpperCase()}${string.substring(1).toLowerCase()}`;
};

const buildStartMessage = (startPayload, user = 'unknown') => {
  const genLetters = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
  let text;

  if (user === 'unknown') {
    text = 'A Guess Who game is running!\n';
  } else {
    text = `${user} has started a Guess Who game!\n`;

    const { chosen, generated } = startPayload;

    if (!Number(chosen)) {
      text += `The Pok\u00E9mon has the ${capitalizeFirst(chosen)} type, and is from Gen ${
        genLetters[Number(generated) - 1]
      }\n`;
    } else {
      text += `The Pok\u00E9mon is from Gen ${genLetters[Number(chosen) - 1]}, and is a ${generated
        .split(' ')
        .map((type) => capitalizeFirst(type))
        .join('\\')} type\n`;
    }
  }

  text += `Place your guesses with '!guesswho guess [Pok\u00E9mon]'`;

  return text;
};

const fetchData = async () => {
  const query = new URLSearchParams(window.location.search);

  const gameKey = query.get('key');

  const response = await fetch(`${UPSTASH_URL}/get/${gameKey}`, {
    headers: {
      Authorization: `Bearer ${UPSTASH_ACCESS_TOKEN}`,
    },
  });

  const responseString = (await response.json()).result;

  if (responseString) {
    const lastAction = JSON.parse(responseString.replaceAll('\\', ''));

    const { action, payload, user } = lastAction;

    switch (action) {
      case 'start':
        startMessage = buildStartMessage(payload, user);
        document.body.innerText = startMessage;

        document.body.style.opacity = 1;

        break;

      case 'guess':
        if (!payload.success) {
          startMessage = buildStartMessage(payload);
          document.body.innerText = startMessage;

          document.body.style.opacity = 1;
        }

        break;

      default:
        break;
    }
  }

  const monitorRes = await fetch(`${UPSTASH_URL}/monitor`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_ACCESS_TOKEN}`,
      Accept: 'text/event-stream',
    },
  });

  const reader = monitorRes.body.pipeThrough(new TextDecoderStream()).getReader();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    if (value.includes(gameKey)) {
      // Find the "object" in the string and parse it to a real object.
      const parsedValue = JSON.parse(value.match(/{.*}/)[0].replaceAll('\\', ''));

      const { action, payload, user } = parsedValue;

      switch (action) {
        case 'start':
          startMessage = buildStartMessage(payload, user);
          document.body.innerText = startMessage;

          document.body.style.opacity = 1;

          break;

        case 'guess':
          const guessTransitionEnd = (newText) => {
            document.body.innerText = newText;

            document.body.style.opacity = 1;
          };

          const startTransitionEnd = (endOpacity) => {
            document.body.innerText = startMessage;

            document.body.style.opacity = endOpacity;
          };

          if (payload.success) {
            startMessage = '';

            document.body.addEventListener(
              'transitionend',
              () =>
                guessTransitionEnd(
                  `${user} guessed correctly!\nThe Pok\u00E9mon was ${capitalizeFirst(
                    payload.guess
                  )}!`
                ),
              { once: true }
            );

            document.body.style.opacity = 0;

            if (guessTimeout) {
              clearInterval(guessTimeout);
              guessTimeout = null;
            }

            guessTimeout = setTimeout(() => {
              document.body.addEventListener('transitionend', () => startTransitionEnd(0), {
                once: true,
              });

              document.body.style.opacity = 0;
            }, 10_000);
          } else {
            document.body.addEventListener(
              'transitionend',
              () =>
                guessTransitionEnd(
                  `${user} tried guessing ${capitalizeFirst(payload.guess)}\nbut that wasn't it...`
                ),
              { once: true }
            );

            document.body.style.opacity = 0;

            if (guessTimeout) {
              clearInterval(guessTimeout);
              guessTimeout = null;
            }

            guessTimeout = setTimeout(() => {
              document.body.addEventListener('transitionend', () => startTransitionEnd(1), {
                once: true,
              });

              document.body.style.opacity = 0;
            }, 10_000);
          }

          break;

        case 'reset':
          const resetTransitionEnd = () => {
            document.body.innerText = '';
            startMessage = '';
          };

          if (guessTimeout) {
            clearInterval(guessTimeout);
          }

          document.body.addEventListener('transitionend', resetTransitionEnd, { once: true });
          document.body.style.opacity = 0;

          break;

        default:
          break;
      }
    }
  }
};

fetchData();
