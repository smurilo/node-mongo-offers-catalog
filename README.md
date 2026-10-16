# Catálogo de Ofertas Telecom — Node.js + MongoDB + Redis

API do **catálogo de planos e ofertas** de uma operadora, consumida pelo app, pelo site e pelos terminais das lojas. Elegibilidade por região (DDD), busca textual, comparação por preço/GB, resumo por segmento e publicação protegida para o back-office.

> Segmento: **Telecomunicações**

## Stack
Node.js 22 • TypeScript 5 • Express 4 • **MongoDB 7** (driver oficial, aggregation pipeline, text index) • **Redis** (ioredis, cache-aside) • JWT (jsonwebtoken) • Zod • Vitest • Supertest • Docker Compose

## Arquitetura hexagonal

```
                        ┌──────────────── application ────────────────┐
 HTTP (Express + Zod) ─►│ CatalogService ─► CachedOfferRepository ─────┼─► OfferRepository (porta) ─► MongoOfferRepository
   JWT p/ back-office   │                    (decorator cache-aside)   │                             InMemoryOfferRepository
                        │                          │                   │
                        │                          └─► Cache (porta) ──┼─► RedisCache | InMemoryCache
                        └──────────────── domain: Offer, isSellable, pricePerGb ─────────────────────┘
```

### Destaques
- **Cache como decorator** da porta de repositório: o caso de uso não sabe que existe Redis. Escrita invalida o namespace com `SCAN` + `UNLINK`, sem bloquear o Redis.
- **Paginação por cursor (keyset)** em vez de `skip`, com desempenho constante em qualquer página.
- **Índices alinhados às consultas**: composto `(active, ddds, segment, monthlyPrice)` + índice **text em português**.
- **Aggregation pipeline** para o resumo por segmento (contagem e menor preço por região).
- **Autorização por papel** (`CATALOG_ADMIN`) apenas para escrita, com algoritmo JWT fixado (`HS256`).

## Endpoints
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/offers?ddd=82&segment=POS_PAGO&maxPrice=150&text=streaming&limit=20&after=<cursor>` | Busca paginada |
| `GET` | `/offers/compare?ids=a,b,c` | Comparação ordenada por preço/GB |
| `GET` | `/regions/:ddd/summary` | Segmentos disponíveis e menor preço |
| `PUT` | `/offers/:id` | Publica/atualiza oferta (JWT com `CATALOG_ADMIN`) |

## Como executar
```bash
docker compose up --build
curl "localhost:3000/offers?ddd=82"
curl "localhost:3000/regions/82/summary"
```

## Testes
```bash
npm install
npm test                                                                  # unitários + HTTP (adaptadores em memória)
MONGO_URL=mongodb://localhost:27017 REDIS_URL=redis://localhost:6379 npm test   # inclui MongoDB e Redis reais
```
