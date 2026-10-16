// Loaded by the mongo container on first start (docker-entrypoint-initdb.d).
db = db.getSiblingDB('catalog');
db.offers.insertMany([
  { _id: 'controle-25gb', name: 'Controle 25GB', segment: 'CONTROLE', monthlyPrice: 49.9, dataGb: 25, ddds: [], benefits: ['WhatsApp ilimitado', 'Ligações ilimitadas'], active: true, validUntil: null },
  { _id: 'pos-100gb-ne', name: 'Pós 100GB Nordeste', segment: 'POS_PAGO', monthlyPrice: 149.9, dataGb: 100, ddds: ['82', '81', '83', '84', '79'], benefits: ['Streaming de vídeo', 'Roaming nacional'], active: true, validUntil: null },
  { _id: 'pos-50gb-sp', name: 'Pós 50GB São Paulo', segment: 'POS_PAGO', monthlyPrice: 99.9, dataGb: 50, ddds: ['11'], benefits: ['Streaming de música'], active: true, validUntil: null },
  { _id: 'pre-semanal', name: 'Pré Semanal', segment: 'PRE_PAGO', monthlyPrice: 19.9, dataGb: 4, ddds: [], benefits: ['Redes sociais sem descontar'], active: true, validUntil: null },
  { _id: 'fibra-600', name: 'Fibra 600 Mega', segment: 'FIBRA', monthlyPrice: 99.9, dataGb: 0, ddds: ['82'], benefits: ['Wi-Fi 6', 'Instalação grátis'], active: true, validUntil: null }
]);
