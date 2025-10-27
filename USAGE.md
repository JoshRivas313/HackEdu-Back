# Proyecto NestJS con OpenAI y Gemini API

Este proyecto integra las APIs de OpenAI y Gemini (Google) en una aplicación NestJS.

## 🚀 Instalación

```bash
# Las dependencias ya están instaladas, pero si necesitas reinstalar:
npm install
```

## 🔑 Configuración

1. Edita el archivo `.env` y agrega tus API keys:

```env
OPENAI_API_KEY=tu-api-key-de-openai
GEMINI_API_KEY=tu-api-key-de-gemini
PORT=3000
```

### Obtener API Keys:
- **OpenAI**: https://platform.openai.com/api-keys
- **Gemini**: https://makersuite.google.com/app/apikey

## 🏃 Ejecutar el Proyecto

```bash
# Desarrollo
npm run start:dev

# Producción
npm run build
npm run start:prod
```

El servidor estará disponible en `http://localhost:3000`

## 📡 Endpoints Disponibles

### OpenAI Endpoints

#### 1. Generar Texto
```bash
POST http://localhost:3000/openai/generate
Content-Type: application/json

{
  "prompt": "Explica qué es NestJS en 3 líneas",
  "model": "gpt-4o-mini"  // opcional
}
```

#### 2. Chat con Contexto
```bash
POST http://localhost:3000/openai/chat
Content-Type: application/json

{
  "messages": [
    {"role": "system", "content": "Eres un asistente útil"},
    {"role": "user", "content": "¿Qué es TypeScript?"}
  ]
}
```

#### 3. Generar Imagen (DALL-E)
```bash
POST http://localhost:3000/openai/image
Content-Type: application/json

{
  "prompt": "Un gato programando en una laptop",
  "size": "1024x1024"  // opcional: 1024x1024, 1792x1024, 1024x1792
}
```

### Gemini Endpoints

#### 1. Generar Texto
```bash
POST http://localhost:3000/gemini/generate
Content-Type: application/json

{
  "prompt": "Escribe un poema sobre la programación",
  "model": "gemini-2.5-flash"  // opcional
}
```

#### 2. Chat con Historial
```bash
POST http://localhost:3000/gemini/chat
Content-Type: application/json

{
  "history": [
    {"role": "user", "parts": "Hola, soy desarrollador"},
    {"role": "model", "parts": "¡Hola! ¿En qué puedo ayudarte?"}
  ],
  "message": "¿Cuál es la diferencia entre let y const?"
}
```

#### 3. Analizar Imagen
```bash
POST http://localhost:3000/gemini/analyze-image
Content-Type: application/json

{
  "prompt": "¿Qué ves en esta imagen?",
  "imageBase64": "base64_string_aqui",
  "mimeType": "image/jpeg"  // opcional
}
```

#### 4. Contar Tokens
```bash
POST http://localhost:3000/gemini/count-tokens
Content-Type: application/json

{
  "text": "Este es un texto de ejemplo para contar tokens"
}
```

## 🧪 Pruebas con cURL

### OpenAI
```bash
# Generar texto
curl -X POST http://localhost:3000/openai/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Hola, ¿cómo estás?"}'

# Chat
curl -X POST http://localhost:3000/openai/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"¿Qué es JavaScript?"}]}'
```

### Gemini
```bash
# Generar texto
curl -X POST http://localhost:3000/gemini/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Explica qué es la inteligencia artificial"}'

# Contar tokens
curl -X POST http://localhost:3000/gemini/count-tokens \
  -H "Content-Type: application/json" \
  -d '{"text":"Este es un texto de prueba"}'
```

## 📁 Estructura del Proyecto

```
src/
├── openai/
│   ├── openai.controller.ts    # Controlador de endpoints OpenAI
│   ├── openai.service.ts       # Lógica de negocio OpenAI
│   └── openai.module.ts        # Módulo OpenAI
├── gemini/
│   ├── gemini.controller.ts    # Controlador de endpoints Gemini
│   ├── gemini.service.ts       # Lógica de negocio Gemini
│   └── gemini.module.ts        # Módulo Gemini
├── app.module.ts               # Módulo principal
└── main.ts                     # Punto de entrada
```

## 🛠️ Tecnologías Utilizadas

- **NestJS**: Framework de Node.js
- **OpenAI SDK**: Cliente oficial de OpenAI
- **Google Generative AI**: SDK de Gemini
- **TypeScript**: Lenguaje de programación
- **dotenv**: Manejo de variables de entorno

## 📝 Notas

- Los modelos disponibles pueden cambiar. Consulta la documentación oficial.
- OpenAI tiene diferentes modelos: gpt-4o, gpt-4o-mini, etc.
- Gemini tiene modelos como: gemini-2.0-flash-exp, gemini-1.5-pro, etc.
- Ambas APIs tienen límites de uso según tu plan.

## 🔒 Seguridad

- Nunca compartas tus API keys
- No subas el archivo `.env` a repositorios públicos
- Agrega `.env` a tu `.gitignore`

## 📚 Recursos

- [Documentación NestJS](https://docs.nestjs.com/)
- [Documentación OpenAI](https://platform.openai.com/docs)
- [Documentación Gemini](https://ai.google.dev/docs)
