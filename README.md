# TorqueSimu

Simulador didático 3D de rotação e torque inspirado na estrutura da imagem de referência: um braço rígido apoiado em um pivô `O`, com `P_B` aplicado a `12 cm` à esquerda e `P_C` aplicado a uma distância ajustável `D` à direita.

## Modelo físico

O simulador considera movimento em um plano vertical em torno do pivô `O`:

- `P_B = m_B g`
- `P_C = m_C g`
- `τ_B = +P_B L_B cos(θ)`
- `τ_C = -P_C D cos(θ)`
- `τ_amort = -c ω`
- `τ_resultante = τ_B + τ_C + τ_amort`
- `α = τ_resultante / I`

A reação normal `N` passa pelo pivô e, por isso, não produz momento em torno de `O`.

> Observação: este é um modelo didático de rotação em plano vertical. Se a estrutura real tiver outro eixo de rotação, geometria tridimensional ou atritos específicos, os parâmetros/modelo devem ser adaptados.

## Stack

- React
- TypeScript
- Vite
- Three.js / React Three Fiber
- Integração numérica RK4 para a dinâmica angular

## Rodar localmente

```bash
npm install
npm run dev
```

Depois abra o endereço exibido pelo Vite.

## Recursos

- Cena 3D interativa com o braço girando.
- Vetores de peso `P_B`, `P_C` e reação `N`.
- Torque de cada lado e torque resultante em tempo real.
- Ângulo, velocidade angular e aceleração angular.
- Ajuste de massas, distância `D`, momento de inércia e amortecimento.
- Preset de equilíbrio automático.
- Gráfico temporal de ângulo e torque.
- Controles iniciar, pausar, passo único e resetar.
