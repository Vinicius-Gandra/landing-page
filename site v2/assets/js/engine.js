/*!
 * VG · Motor de cálculo — Ponta de eixo + Mancal de deslizamento
 * ----------------------------------------------------------------------------
 * Porte 1:1 do programa "dimensionamento_eixo.py" (v2.0), validado contra as
 * 39.900 células das tabelas do procedimento e contra a planilha de mancais.
 * Os nomes de campos de entrada e de saída são os mesmos do programa Python
 * (snake_case), o que permite conferir os dois automaticamente.
 *
 *   Unidades internas: kW · rpm · N·m · mm · MPa (= N/mm²) · °C · Pa·s
 *
 * Uso no navegador:  VGEngine.calcular(entrada)
 * Uso no Node:       const VGEngine = require('./engine.js')
 * Sem dependências.
 */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (raiz) raiz.VGEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DADOS = {"MATERIAIS":[{"nome":"AISI 1045","ruptura":630,"escoamento":370,"tau_max":214,"tau_adm":142,"temp_min":-20,"soldavel":false,"observacao":""},{"nome":"AISI 1524","ruptura":510,"escoamento":283,"tau_max":163,"tau_adm":109,"temp_min":-20,"soldavel":true,"observacao":"SPIDER ARM"},{"nome":"AISI 8620","ruptura":530,"escoamento":385,"tau_max":222,"tau_adm":148,"temp_min":-20,"soldavel":true,"observacao":"SPIDER ARM"},{"nome":"AISI 4140","ruptura":655,"escoamento":420,"tau_max":242,"tau_adm":162,"temp_min":-40,"soldavel":false,"observacao":""},{"nome":"AISI 4340","ruptura":810,"escoamento":745,"tau_max":430,"tau_adm":287,"temp_min":-50,"soldavel":false,"observacao":""}],"APLICACOES":[["GERADORES",1.25],["MOENDAS",2.0],["MOINHOS DE CIMENTO",2.0],["VENTILADORES DE GRANDE PORTE",2.0],["BOMBAS CENTRÍFUGAS",2.5],["COMPRESSORES",2.5],["TRITURADORES",2.5],["BOMBAS ALTERNATIVAS",3.0],["BOMBAS DE ÓLEO PARA POÇOS",3.0],["LAMINADORES",3.0]],"ORDEM_APLICACOES_SECAO9":["BOMBAS ALTERNATIVAS","BOMBAS CENTRÍFUGAS","BOMBAS DE ÓLEO PARA POÇOS","COMPRESSORES","GERADORES","LAMINADORES","MOENDAS","MOINHOS DE CIMENTO","TRITURADORES","VENTILADORES DE GRANDE PORTE"],"FS_TABELAS_SECAO8":[1.0,1.25,2.0,2.5,3.0],"COLUNAS_ROTACAO":[[60,2],[50,2],[60,4],[50,4],[60,6],[50,6],[60,8],[50,8],[60,10],[50,10],[60,12],[50,12]],"DIAMETROS_SECAO8":[110,120,130,140,150,160,170,180,190,200,220,240,250,260,280,300,320,340,360,380,400,420,440,450,460,480,500,530,560,600,630],"DIN748_ATE_100":[6,7,8,9,10,11,12,14,16,19,20,22,24,25,28,30,32,35,38,40,42,45,48,50,55,60,65,70,75,80,85,90,95,100],"HARMONIZACAO_IEC":[[6,"k6",[]],[11,"k6",[["63",null]]],[14,"k6",[["71",null]]],[19,"k6",[["80",null]]],[24,"k6",[["90",null]]],[28,"k6",[["100",null],["112",null]]],[38,"k6",[["132",null]]],[42,"k6",[["160",null]]],[48,"k6",[["180",null]]],[55,"m6",[["200",null],["225 SM","2"]]],[60,"m6",[["225 SM","demais"],["250 SM","2"]]],[65,"m6",[["250 SM","demais"],["280 SM","2"],["315 SM","2"],["355 ML","2"]]],[75,"m6",[["280 SM","demais"]]],[80,"m6",[["315 SM","demais"]]],[100,"m6",[["355 ML","demais"],["355 AB",null]]]],"GRUPOS_COMPRIMENTO":[[[6,7],16,null],[[8,9],20,null],[[10,11],23,15],[[12,14],30,18],[[16,18,19],40,28],[[20,22,24],50,36],[[25,28],60,42],[[30,32,35,38],80,58],[[40,42,45,48,50,55,56],110,82],[[60,63,65,70,71,75],140,105],[[80,85,90,95],170,130],[[100,110,120,125],210,165],[[130,140,150],250,200],[[160,170,180],300,240],[[190,200,220],350,280],[[240,250,260],410,330],[[280,300,320],470,380],[[340,360,380],550,450],[[400,420,440,450,460,480,500],650,540],[[530,560,600,630],800,680]],"TIPOS_CARGA":[{"grupo":1,"exemplos":"Bombas centrífugas, ventiladores, furadeiras, compressores, retificadoras, trituradoras","partida":"Entre 1 e 1,5 vezes o conjugado nominal","maximo":"Valores máximos entre 220% e 250% do nominal","caracteristicas":["Condições de partidas fáceis, tais como: engrenagens intermediárias, baixa inércia ou uso de acoplamentos especiais, simplificam a partida.","Máquinas centrífugas, tais como: bombas onde o conjugado aumenta em função do quadrado da velocidade até um máximo, conseguido na velocidade nominal.","Na velocidade nominal pode estar sujeita a pequenas sobrecargas."],"motor":"Conjugado normal · corrente de partida normal · Categoria N"},{"grupo":2,"exemplos":"Bombas alternativas, compressores, carregadores, alimentadores, laminadores de barras","partida":"Entre 2 e 3 vezes o conjugado nominal","maximo":"Não maior que 2 vezes o conjugado nominal","caracteristicas":["Conjugado de partida alto para vencer a elevada inércia, contra pressão, atrito de parada, rigidez nos processos de materiais ou condições mecânicas similares.","Durante a aceleração, o conjugado exigido cai para o valor do conjugado nominal.","É desaconselhável sujeitar o motor a sobrecargas, durante a velocidade nominal."],"motor":"Conjugado de partida alto · corrente de partida normal · Categoria N"},{"grupo":3,"exemplos":"Prensas puncionadoras, guindastes, pontes rolantes, elevadores de talha, tesouras mecânicas, bombas de óleo para poços","partida":"3 vezes o conjugado nominal","maximo":"Requer 2 a 3 vezes o conjugado nominal. São consideradas perdas durante os picos de carga.","caracteristicas":["Cargas intermitentes, as quais requerem conjugado de partida, alto ou baixo. Requerem partidas frequentes, paradas e reversões.","Máquinas acionadas, tais como: prensas puncionadoras, que podem usar volantes para suportar os picos de potência.","Pequena regulagem é conveniente para amenizar os picos de potências e reduzir os esforços mecânicos no equipamento acionado.","A alimentação precisa ser protegida dos picos de potências, resultantes das flutuações de carga."],"motor":"Conjugado de partida alto · corrente de partida normal · alto escorregamento · Categoria D"}],"APLICACAO_GRUPO_CARGA":{"BOMBAS CENTRÍFUGAS":[1],"VENTILADORES DE GRANDE PORTE":[1],"COMPRESSORES":[1,2],"TRITURADORES":[1],"BOMBAS ALTERNATIVAS":[2],"LAMINADORES":[2],"BOMBAS DE ÓLEO PARA POÇOS":[3]},"CATEGORIAS_MOTOR":[["N","Conjugado de partida normal, corrente de partida normal; baixo escorregamento. Constituem a maioria dos motores encontrados no mercado e prestam-se ao acionamento de cargas normais, como bombas, máquinas operatrizes, ventiladores."],["H","Conjugado de partida alto, corrente de partida normal; baixo escorregamento. Usados para cargas que exigem maior conjugado na partida, como peneiras, transportadores carregadores, cargas de alta inércia, britadores, etc."],["D","Conjugado de partida alto, corrente de partida normal; alto escorregamento (+ de 5%). Usados em prensas excêntricas e máquinas semelhantes, onde a carga apresenta picos periódicos. Usados também em elevadores e cargas que necessitam de conjugados de partida muito altos e corrente de partida limitada."],["NY","Semelhantes aos de categoria N, porém previstos para partida estrela-triângulo. Na ligação estrela, os valores mínimos do conjugado com rotor bloqueado e do conjugado mínimo de partida são iguais a 25% dos valores indicados para a categoria N."],["HY","Semelhantes aos de categoria H, porém previstos para partida estrela-triângulo. Na ligação estrela, os valores mínimos do conjugado com rotor bloqueado e do conjugado mínimo de partida são iguais a 25% dos valores indicados para a categoria H."]],"CRITERIOS":[["SECAO_5","Seção 5/8 — equação do documento (τ = τmáx da seção 4 ≈ Se/√3)"],["SECAO_9","Seção 9 — tabelas por aplicação (τ = Se/3 = Tresca ÷ 1,5)"],["MAIOR","Os dois critérios — adotar o maior diâmetro"],["PERSONALIZADO","Personalizado — τ informado pelo usuário"]],"CRITERIO_CURTO":{"SECAO_5":"Seção 5/8","SECAO_9":"Seção 9","MAIOR":"Maior (5/8 × 9)","PERSONALIZADO":"Personalizado"},"ERRATA_DOCUMENTO":[["E1","Tabelas 9.1.1, 9.3.1 e 9.6.1 (AISI 1045, FS 3,00)","A partir da linha de 1.580 kW os valores foram calculados sem o fator 1,5 (τ = Se/2 em vez de Se/3): ficam ≈12,6% menores que o critério da própria seção 9 (lado não conservador). As linhas de 1.000 a 1.450 kW estão coerentes."],["E2","Tabelas 9.7.3, 9.8.3 e 9.10.3 (AISI 8620, FS 2,00)","Valores idênticos aos das tabelas de FS 2,50 (9.2.3, 9.4.3, 9.9.3), isto é, calculados com FS 2,5: ficam ≈7,7% maiores que o esperado para FS 2,0 (lado conservador)."],["E3","Seção 9 × seções 5 e 8","As tabelas da seção 9 usam τ = Se/3, enquanto a equação da seção 5 e as tabelas da seção 8 usam τmáx da seção 4 (≈ Se/√3). Resultado: diâmetros da seção 9 ≈ 20% maiores (∛(τmáx/(Se/3)) ≈ 1,20)."]],"POTENCIAS_SECAO9":[1000.0,1100.0,1200.0,1320.0,1450.0,1580.0,1740.0,1910.0,2090.0,2290.0,2510.0,2750.0,3020.0,3310.0,3630.0,3980.0,4370.0,4790.0,5250.0,5750.0,6310.0,6920.0,7590.0,8320.0,9120.0,10000.0,10960.0,12020.0,13180.0,14450.0,15850.0,17380.0,19050.0,20890.0,22910.0,25120.0,27540.0,30200.0,33110.0,36310.0,39810.0,43650.0,47860.0,52480.0,57540.0,63100.0,69180.0,75860.0,83180.0,91200.0,100000.0],"MANCAL_DIAMETROS":[25,30,35,40,45,50,55,60,70,80,90,100,110,120,125,140,160,180,200,225,250,280,314,315,335,354,375,400,425,450,475,500,530,560,630,710,800,900,1000,1120,1250],"MANCAL_LARGURAS":[18,20,25,30,35,40,45,50,55,60,80,105,106.4,135,140.4,170,175.7,215,218.5,254,263.2,318.8,329,409,418.8,429,522,534,534.6,549.2,552,554.4,574.6],"H_LIM_TABELA":{"1":[0.003,0.004,0.006,0.008,0.01],"2":[0.004,0.005,0.008,0.011,0.014],"3":[0.005,0.007,0.01,0.013,0.016],"4":[0.007,0.009,0.012,0.015,0.018],"5":[0.009,0.012,0.015,0.018,0.021],"6":[0.012,0.015,0.018,0.021,0.024]},"PSI_TABELA":{"1":[1.32,1.6,1.9,2.24,null],"2":[1.12,1.32,1.6,1.9,null],"3":[1.12,1.12,1.32,1.6,null],"4":[0.8,1.12,1.32,1.32,null]},"PSI_SERIE":[0.56,0.8,1.12,1.32,1.6,1.9,2.24,3.15],"IT7_FURO":[[18,0.018],[30,0.021],[50,0.025],[80,0.03],[120,0.035],[180,0.04],[250,0.046],[315,0.052],[400,0.057],[500,0.063],[630,0.07],[800,0.08],[1000,0.09],[1250,0.105],[1600,0.125],[2000,0.15]],"FOLGA_MAX_TABELA":[[30,[0,0.03,0.038,0.044,0.052,0.06,0.073,0.098]],[35,[0,0.035,0.045,0.052,0.061,0.075,0.086,0.116]],[40,[0.03,0.039,0.051,0.063,0.074,0.085,0.098,0.132]],[45,[0.031,0.043,0.061,0.07,0.082,0.094,0.109,0.147]],[50,[0.036,0.052,0.067,0.076,0.09,0.104,0.12,0.163]],[55,[0.04,0.058,0.075,0.085,0.1,0.116,0.144,0.181]],[60,[0.043,0.062,0.08,0.092,0.108,0.125,0.145,0.197]],[70,[0.053,0.068,0.09,0.102,0.129,0.148,0.17,0.229]],[80,[0.058,0.076,0.109,0.124,0.145,0.167,0.193,0.261]],[90,[0.066,0.087,0.124,0.141,0.165,0.19,0.219,0.296]],[100,[0.072,0.095,0.135,0.154,0.181,0.209,0.241,0.328]],[110,[0.077,0.113,0.146,0.167,0.197,0.228,0.264,0.359]],[120,[0.093,0.121,0.157,0.18,0.213,0.247,0.286,0.391]],[140,[0.105,0.137,0.178,0.204,0.241,0.28,0.324,0.442]],[160,[0.117,0.153,0.201,0.231,0.273,0.318,0.369,0.505]],[180,[0.128,0.179,0.223,0.257,0.305,0.356,0.413,0.568]],[200,[0.144,0.19,0.25,0.288,0.342,0.399,0.463,0.636]],[225,[0.157,0.208,0.276,0.318,0.378,0.441,0.514,0.707]],[250,[0.171,0.228,0.304,0.351,0.418,0.489,0.57,0.786]],[280,[0.19,0.254,0.339,0.392,0.466,0.546,0.636,0.877]],[315,[0.209,0.28,0.375,0.435,0.518,0.607,0.708,0.979]],[355,[0.234,0.315,0.422,0.489,0.583,0.683,0.799,1.102]],[400,[0.258,0.349,0.469,0.545,0.651,0.764,0.892,1.236]],[450,[0.29,0.392,0.528,0.613,0.732,0.859,1.004,1.39]],[500,[0.318,0.432,0.584,0.679,0.812,0.954,1.116,1.548]],[560,[0.354,0.481,0.651,0.757,0.905,1.064,1.244,1.727]],[630,[0.39,0.533,0.723,0.842,1.009,1.188,1.39,1.966]],[710,[0.44,0.601,0.815,0.949,1.137,1.338,1.566,2.176]],[800,[0.488,0.669,0.911,1.062,1.273,1.5,1.756,2.443]],[900,[0.549,0.753,1.025,1.195,1.433,1.688,1.977,2.751]],[1000,[0.605,0.833,1.137,1.327,1.593,1.878,2.201,3.066]],[1120,[0.679,0.934,1.273,1.485,1.782,2.1,2.46,3.425]],[1250,[0.749,1.034,1.413,1.65,1.982,2.337,2.74,3.818]]],"FOLGA_MIN_TABELA":[[30,[0,0.015,0.023,0.029,0.037,0.045,0.051,0.076]],[35,[0,0.017,0.027,0.034,0.043,0.048,0.059,0.089]],[40,[0.012,0.021,0.033,0.036,0.047,0.058,0.071,0.105]],[45,[0.014,0.025,0.034,0.043,0.055,0.067,0.082,0.12]],[50,[0.018,0.025,0.04,0.049,0.063,0.077,0.093,0.136]],[55,[0.019,0.026,0.043,0.053,0.068,0.084,0.102,0.149]],[60,[0.022,0.03,0.048,0.06,0.076,0.093,0.113,0.165]],[70,[0.02,0.036,0.057,0.07,0.08,0.099,0.121,0.18]],[80,[0.026,0.044,0.06,0.075,0.096,0.118,0.144,0.212]],[90,[0.029,0.05,0.067,0.084,0.108,0.133,0.162,0.239]],[100,[0.035,0.058,0.078,0.097,0.124,0.152,0.184,0.271]],[110,[0.04,0.056,0.089,0.11,0.14,0.171,0.207,0.302]],[120,[0.036,0.064,0.1,0.122,0.156,0.19,0.229,0.334]],[140,[0.04,0.072,0.113,0.139,0.176,0.215,0.259,0.377]],[160,[0.052,0.088,0.136,0.166,0.208,0.253,0.304,0.44]],[180,[0.063,0.104,0.158,0.192,0.24,0.291,0.348,0.503]],[200,[0.069,0.115,0.175,0.213,0.267,0.324,0.388,0.581]],[225,[0.082,0.133,0.201,0.243,0.303,0.366,0.439,0.632]],[250,[0.096,0.153,0.229,0.276,0.343,0.414,0.495,0.711]],[280,[0.106,0.17,0.255,0.308,0.382,0.462,0.552,0.793]],[315,[0.125,0.196,0.291,0.351,0.434,0.523,0.624,0.895]],[355,[0.141,0.222,0.329,0.396,0.49,0.59,0.704,1.009]],[400,[0.165,0.256,0.376,0.452,0.558,0.671,0.799,1.143]],[450,[0.187,0.289,0.425,0.51,0.629,0.756,0.901,1.287]],[500,[0.215,0.329,0.481,0.576,0.709,0.851,1.013,1.445]],[560,[0.24,0.367,0.537,0.643,0.791,0.95,1.13,1.613]],[630,[0.276,0.419,0.609,0.728,0.895,1.074,1.276,1.852]],[710,[0.31,0.471,0.685,0.819,1.007,1.208,1.436,2.046]],[800,[0.358,0.539,0.781,0.932,1.143,1.37,1.626,2.313]],[900,[0.403,0.607,0.879,1.049,1.287,1.542,1.831,2.605]],[1000,[0.459,0.687,0.991,1.181,1.447,1.732,2.055,2.92]],[1120,[0.508,0.765,1.102,1.314,1.611,1.929,2.289,3.254]],[1250,[0.578,0.863,1.242,1.479,1.811,2.166,2.569,3.647]]],"VG_TABELA":{"1":[68,46,46,32,32],"2":[100,68,46,46,32],"3":[150,100,68,46,46]},"OLEOS":[[22,{"rho15":857.0,"nu100":4.3}],[32,{"rho15":863.0,"nu100":5.4}],[46,{"rho15":869.0,"nu100":6.8}],[68,{"rho15":874.0,"nu100":8.7}],[100,{"rho15":880.0,"nu100":11.2}],[150,{"rho15":885.0,"nu100":14.7}],[220,{"rho15":890.0,"nu100":19.0}]],"ERRATA_PLANILHA_MANCAL":[["M1","Número de Sommerfeld (Planilha1, linhas 40–42)","A planilha usa a velocidade periférica v [m/s] no lugar da velocidade angular ω [rad/s]: So = p·ψ²/(η·v). A definição correta (DIN 31652 / ISO 7902) é So = p·ψ²/(η·ω). Com D = 200 mm o So fica 10× maior (fator 2/D), o que superestima ε e subestima o atrito (≈5×) e o h mín (≈4×)."],["M2","Excentricidade ε e ângulo β (Planilha1, linhas 43–48)","Eram digitados à mão a partir dos gráficos. O programa calcula ε e β automaticamente pela solução numérica da equação de Reynolds para o B/D do mancal."],["M3","Seleção do ISO VG (TABELAS_GERAIS AY8)","A fórmula usa 1,5 N/mm² como limite da faixa intermediária, mas os rótulos e a tabela AS:AT indicam 2,5 N/mm². Adotado 2,5 N/mm² (rótulos)."],["M4","Índice de velocidade do óleo (TABELAS_GERAIS AY9)","O PROCV aproximado retorna #N/D para v < 3 m/s (primeira chave = 3). Corrigido: v ≤ 3 m/s → coluna “≤ 3”."],["M5","Tabelas de folga (TABELAS_GERAIS AC11:AC12 e AQ67:AQ68)","Folga máxima D 45–50 mm, ψ 1,32 ‰ = 0,76 mm (faltou um zero → 0,076). Folga mínima D 1120–1250 mm, ψ 3,15 ‰ = 3,818 mm, igual à máxima (→ 3,647 mm, mantendo a faixa de 0,171 mm da linha). Conferir também AN35:AN36… (D 180–200, ψ 3,15: mín. 0,581) e AF13:AF14 (D 50–55, ψ 2,24: máx. 0,144), com faixas atípicas."],["M6","Viscosidade × temperatura (Planilha1, linhas 29–39)","A relação de Vogel com b = 159,56·e^η40 só reproduz η40 porque a planilha avalia sempre a 40 °C; para outras temperaturas daria, p.ex., ν100 ≈ 23 mm²/s para VG 32 (real ≈ 5,4). O programa usa a curva ASTM D341 (Walther), idêntica à planilha a 40 °C."],["M7","Diâmetros fora da lista (TABELAS_GERAIS K4 e Y4)","O PROCV exato só aceita diâmetros da lista e o PROCV das folgas falha para D < 30 mm (D = 25 da própria lista dá #N/D). O programa aceita qualquer D entre 24 e 1.250 mm."],["M8","Planilha1 × tabelas","Para 600 rpm foi digitado ψ = 1,12 ‰ (a tabela indica 1,32 ‰) e em algumas colunas a tolerância do eixo foi 0,019 mm (as tabelas usam 0,029 mm para D 180–250)."]],"MANCAL_BD":[0.125,0.166667,0.25,0.333333,0.5,0.625,0.75,0.875,1.0,1.25,1.5],"MANCAL_EPS":[0.05,0.1,0.15,0.2,0.25,0.3,0.35,0.4,0.45,0.5,0.55,0.6,0.65,0.7,0.725,0.75,0.775,0.8,0.825,0.85,0.875,0.9,0.91,0.92,0.93,0.94,0.95,0.96,0.97,0.98,0.99],"MANCAL_SO":[[0.0012265,0.0024955,0.0038531,0.0053522,0.0070582,0.0090554,0.011458,0.014424,0.018188,0.023102,0.029719,0.038959,0.052437,0.073203,0.08807,0.10759,0.13391,0.17058,0.22375,0.30499,0.43795,0.67767,0.83097,1.0419,1.3435,1.7963,2.5216,3.7929,6.3436,12.776,39.346],[0.0021704,0.0044155,0.0068158,0.0094641,0.012475,0.015994,0.020221,0.025433,0.032031,0.040625,0.052167,0.068233,0.091573,0.12735,0.15285,0.1862,0.23098,0.293,0.38237,0.51773,0.73689,1.1264,1.3722,1.7074,2.1812,2.8824,3.9855,5.8745,9.5478,18.416,52.265],[0.0048222,0.0098062,0.015126,0.020983,0.027621,0.035355,0.044606,0.055958,0.070258,0.088769,0.11346,0.14754,0.19657,0.27078,0.32309,0.3909,0.48097,0.6042,0.77915,1.0394,1.4511,2.1603,2.5971,3.1813,3.9887,5.153,6.9307,9.8611,15.286,27.542,70.128],[0.00843,0.017134,0.026406,0.036584,0.048077,0.061409,0.077274,0.096634,0.12086,0.15199,0.19317,0.24946,0.32948,0.44896,0.53218,0.63899,0.77927,0.96871,1.2334,1.6201,2.2189,3.222,3.8258,4.6217,5.7027,7.2301,9.5103,13.166,19.737,34.023,81.337],[0.018151,0.036846,0.056663,0.078264,0.10244,0.13018,0.16281,0.20208,0.25049,0.31166,0.39106,0.49731,0.64475,0.85855,1.0039,1.1871,1.4227,1.7334,2.1563,2.7559,3.6508,5.0915,5.9327,7.0166,8.4575,10.444,13.33,17.825,25.633,42.015,94.083],[0.027245,0.055246,0.084808,0.11684,0.15243,0.19291,0.24003,0.29614,0.36447,0.44968,0.5587,0.70233,0.89807,1.1765,1.3627,1.5945,1.889,2.272,2.7854,3.501,4.5508,6.2059,7.1582,8.3749,9.9755,12.163,15.302,20.14,28.452,45.656,99.608],[0.037515,0.075987,0.11643,0.16,0.20802,0.26216,0.32454,0.39797,0.48635,0.59512,0.73239,0.91051,1.1495,1.4834,1.7038,1.9754,2.3169,2.756,3.3384,4.1395,5.2999,7.1055,8.1341,9.4404,11.15,13.468,16.776,21.844,30.485,48.225,103.42],[0.048657,0.098448,0.15057,0.20638,0.26742,0.33562,0.41341,0.50399,0.61171,0.74268,0.90578,1.1146,1.3908,1.771,2.0191,2.3226,2.7007,3.1833,3.817,4.6821,5.9233,7.836,8.9181,10.289,12.073,14.484,17.912,23.14,32.014,50.132,106.21],[0.060403,0.12208,0.18639,0.25483,0.32913,0.41143,0.50437,0.61146,0.73738,0.88869,1.0749,1.3104,1.618,2.0362,2.3065,2.6351,3.0419,3.5575,4.2308,5.1434,6.4441,8.4354,9.5581,10.975,12.814,15.294,18.81,24.156,33.201,51.601,108.33],[0.084832,0.17112,0.2604,0.35435,0.45494,0.56453,0.68606,0.82336,0.98153,1.1677,1.392,1.67,2.0256,2.4998,2.8022,3.1662,3.613,4.1744,4.9007,5.8772,7.2578,9.3563,10.533,12.011,13.925,16.499,20.135,25.641,34.922,53.71,111.34],[0.10941,0.22032,0.33429,0.45307,0.57867,0.71353,0.86069,1.0241,1.2091,1.4229,1.6762,1.9849,2.3738,2.8852,3.2083,3.5948,4.0664,4.6562,5.4157,6.4317,7.8618,10.026,11.236,12.753,14.715,17.349,21.06,26.67,36.104,55.145,113.37]],"MANCAL_BETA":[[86.36,82.73,79.1,75.48,71.86,68.25,64.64,61.03,57.42,53.79,50.14,46.45,42.7,38.86,36.89,34.88,32.81,30.69,28.48,26.17,23.72,21.09,19.96,18.79,17.55,16.24,14.83,13.29,11.57,9.56,6.97],[86.37,82.75,79.13,75.51,71.91,68.3,64.7,61.1,57.5,53.88,50.24,46.56,42.81,38.98,37.02,35.01,32.96,30.84,28.64,26.34,23.91,21.29,20.17,19.0,17.77,16.47,15.07,13.55,11.84,9.83,7.24],[86.4,82.8,79.21,75.62,72.04,68.46,64.88,61.31,57.72,54.13,50.51,46.85,43.14,39.33,37.39,35.4,33.36,31.26,29.08,26.79,24.38,21.79,20.68,19.53,18.31,17.02,15.63,14.11,12.4,10.37,7.71],[86.44,82.88,79.32,75.76,72.21,68.67,65.13,61.58,58.03,54.47,50.88,47.25,43.57,39.79,37.85,35.88,33.86,31.77,29.61,27.35,24.95,22.37,21.27,20.11,18.89,17.6,16.2,14.67,12.92,10.84,8.06],[86.53,83.07,79.6,76.14,72.68,69.23,65.77,62.3,58.83,55.34,51.82,48.26,44.63,40.92,39.01,37.06,35.05,32.99,30.84,28.58,26.18,23.58,22.46,21.29,20.04,18.71,17.26,15.66,13.82,11.59,8.58],[86.62,83.24,79.86,76.49,73.11,69.73,66.34,62.95,59.54,56.11,52.65,49.13,45.55,41.86,39.97,38.02,36.02,33.95,31.8,29.52,27.09,24.45,23.3,22.1,20.82,19.44,17.95,16.28,14.35,12.02,8.86],[86.72,83.43,80.15,76.86,73.57,70.27,66.97,63.65,60.31,56.94,53.53,50.07,46.51,42.85,40.95,39.01,37.01,34.93,32.75,30.44,27.97,25.26,24.08,22.85,21.52,20.1,18.54,16.81,14.8,12.38,9.08],[86.82,83.63,80.45,77.25,74.06,70.85,67.62,64.38,61.11,57.81,54.45,51.02,47.5,43.84,41.95,40.0,37.98,35.87,33.67,31.32,28.79,26.01,24.8,23.52,22.16,20.68,19.07,17.27,15.19,12.68,9.26],[86.92,83.84,80.75,77.66,74.56,71.44,68.3,65.13,61.93,58.68,55.37,51.98,48.48,44.82,42.92,40.96,38.92,36.79,34.54,32.15,29.56,26.7,25.46,24.14,22.73,21.21,19.54,17.67,15.53,12.93,9.41],[87.13,84.26,81.38,78.48,75.57,72.63,69.65,66.64,63.57,60.43,57.2,53.87,50.39,46.72,44.8,42.79,40.7,38.51,36.18,33.68,30.96,27.94,26.63,25.23,23.74,22.12,20.35,18.37,16.09,13.36,9.66],[87.34,84.67,81.99,79.29,76.56,73.79,70.98,68.1,65.15,62.11,58.96,55.67,52.2,48.5,46.54,44.5,42.35,40.08,37.66,35.05,32.2,29.03,27.64,26.17,24.6,22.89,21.03,18.95,16.56,13.7,9.86]],"REFERENCIAS":["Procedimento “Determinação do Diâmetro Mínimo do Eixo” (seções 4 a 9) — equação (seção 5), materiais (seção 4), fatores de serviço (6.2.7), harmonização IEC (seção 7), tabelas das seções 8 e 9.","IEC 60072-1 e IEC 60072-2 — dimensões e séries de potência de máquinas elétricas rotativas.","DIN 748-1 — pontas de eixo cilíndricas (diâmetros normalizados).","ABNT NBR 7094 — categorias de conjugado de motores de indução (N, H, D, NY, HY).","Martignone, A. — Máquinas de Corrente Alternada, Ed. Globo, p. 103–104.","Siemens — Fundamental Principles of Mechanical Engineering (Technical Handbook).","WEG — Manual técnico de motores elétricos.","Planilha de mancais de deslizamento (planilha_mancais.xlsx) — tabelas de h lim, folga relativa, ajuste H7 × eixo e seleção do óleo; método da Planilha1 com as correções M1–M8.","DIN 31652 / ISO 7902 — mancais radiais hidrodinâmicos; DIN 31698 — folgas de mancais; ASTM D341 — viscosidade × temperatura; Raimondi & Boyd (1958) — referência para a solução de Reynolds."]};


  const VERSAO = '2.0';
  const K_TORQUE = 9550.0;               // Mt [N·m] = 9550 · P[kW] / n[rpm]   (seção 5)
  const FATOR_SEGURANCA_PADRAO = 9.0;    // mínimo 9 sobre o escoamento por cisalhamento (seção 5)
  const KW_POR_CV = 0.73549875;
  const KW_POR_HP = 0.745699872;
  const UNIDADES_POTENCIA = ['kW', 'MW', 'kVA', 'MVA', 'cv', 'HP'];
  const TIPOS_MAQUINA = ['Gerador', 'Motor', 'Outro'];
  const MATERIAL_PERSONALIZADO = 'Personalizado';
  const APLICACAO_OUTRA = 'OUTRA (informar FS)';
  const SERIE_PADRAO = 'DIN 748-1';
  const CRITERIO_PADRAO = 'SECAO_5';

  // Mancal
  const G_ACEL = 9.81;
  const MANCAL_D_MIN = 24.0, MANCAL_D_MAX = 1250.0;
  const MANCAL_BD_PADRAO = 0.8;
  const VG_LIMITES_PRESSAO = [1.25, 2.5];
  const VG_LIMITES_VELOCIDADE = [3.0, 10.0, 25.0, 50.0];
  const OLEOS_COMPARACAO = [32, 46, 68];
  const CP_OLEO = 1785.0;                // J/(kg·K)
  const COEF_DILATACAO_OLEO = 0.00065;   // 1/K
  const MODULO_OLEO = 1.4e9;             // Pa
  const VOLUME_OLEO_PADRAO = 17.5;       // L
  const P_LIM_PADRAO = 2.5;              // N/mm²
  const P_MAX_METAL_PATENTE = 5.0;       // N/mm² (DIN 31652-3)
  const T_LIM_PADRAO = 90.0;             // °C
  const T_EFETIVA_PADRAO = 40.0;         // °C
  const ALFA_CAIXA_PADRAO = 20.0;        // W/(m²·K)
  const T_AMBIENTE_PADRAO = 40.0;        // °C

  // ── Dados derivados ────────────────────────────────────────────────────────
  const MATERIAIS = {};
  for (const m of DADOS.MATERIAIS) MATERIAIS[m.nome] = criarMaterial(m);
  const ORDEM_MATERIAIS_DOC = DADOS.MATERIAIS.map(m => m.nome);
  const APLICACOES = {};
  for (const [nome, fs] of DADOS.APLICACOES) APLICACOES[nome] = fs;
  const CRITERIOS = {};
  for (const [k, v] of DADOS.CRITERIOS) CRITERIOS[k] = v;
  const CATEGORIAS_MOTOR = {};
  for (const [k, v] of DADOS.CATEGORIAS_MOTOR) CATEGORIAS_MOTOR[k] = v;
  const CRITERIO_CURTO = DADOS.CRITERIO_CURTO;
  const COLUNAS_ROTACAO = DADOS.COLUNAS_ROTACAO;
  const ROTACOES_COLUNAS = COLUNAS_ROTACAO.map(([f, p]) => rotacao_sincrona(f, p));
  const DIAMETROS_SECAO8 = DADOS.DIAMETROS_SECAO8;
  const SERIES_DIAMETROS = {
    'DIN 748-1': DADOS.DIN748_ATE_100.concat(DADOS.DIAMETROS_SECAO8),
    'Múltiplos de 5 mm': Array.from({ length: 400 }, (_, i) => (i + 1) * 5),
    'Múltiplos de 10 mm': Array.from({ length: 200 }, (_, i) => (i + 1) * 10)
  };
  const COMPRIMENTO_PONTA = {};
  for (const [ds, longo, curto] of DADOS.GRUPOS_COMPRIMENTO) for (const d of ds) COMPRIMENTO_PONTA[d] = [longo, curto];
  const POTENCIAS_SECAO9 = DADOS.POTENCIAS_SECAO9;
  const OLEOS = {};
  for (const [vg, o] of DADOS.OLEOS) OLEOS[vg] = o;
  const LISTA_OLEOS = DADOS.OLEOS.map(([vg]) => vg);
  const PSI_SERIE = DADOS.PSI_SERIE;
  const MANCAL_BD = DADOS.MANCAL_BD, MANCAL_EPS = DADOS.MANCAL_EPS;
  const LOG_SO = DADOS.MANCAL_SO.map(l => l.map(Math.log));
  const LOG_BD = MANCAL_BD.map(Math.log);

  function criarMaterial(m) {
    return Object.freeze(Object.assign({ fs_torcao: FATOR_SEGURANCA_PADRAO, personalizado: false, observacao: '' }, m, {
      tau_secao9: m.escoamento / 3.0,               // tabelas da seção 9: τ = Se/3
      tau_escoamento: m.escoamento / Math.sqrt(3.0)  // von Mises: Se/√3
    }));
  }

  class ErroEntrada extends Error {
    constructor(erros) {
      super(erros.join('\n'));
      this.name = 'ErroEntrada';
      this.erros = erros;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 1. Utilitários — formatação brasileira, leitura de números, textos
  // ════════════════════════════════════════════════════════════════════════

  /** toFixed com o mesmo arredondamento do Python (valor binário exato; empates exatos → par). */
  function toFixedPy(x, c) {
    const ax = Math.abs(x);
    const s = ax.toFixed(c + 1);
    if (s.endsWith('5') && Number(s) === ax) {
      const N = Number(s.replace('.', ''));
      if (Number.isSafeInteger(N) && N % (5 ** (c + 1)) === 0) {   // decimal exatamente representável → empate
        let q = (N - 5) / 10;
        if (q % 2 === 1) q += 1;
        const t = String(q).padStart(c + 1, '0');
        return c > 0 ? t.slice(0, -c) + '.' + t.slice(-c) : t;
      }
    }
    return ax.toFixed(c);
  }
  /** round(x, n) do Python (correto e com empate para o par). */
  function arredondar(x, n = 0) { const v = Number(toFixedPy(x, n)); return x < 0 ? -v : v; }

  /** Formata no padrão brasileiro: 12.345,6 */
  function fmt(x, casas = 1, milhar = true, vazio = '—') {
    if (x === null || x === undefined || x === '') return vazio;
    const xf = Number(x);
    if (!Number.isFinite(xf)) return vazio;
    let s = toFixedPy(xf, casas);
    let [int, dec] = s.split('.');
    if (milhar) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const neg = xf < 0 && Number(s) !== 0;
    return (neg ? '−' : '') + int + (dec ? ',' + dec : '');
  }
  const fmt_int = (x, vazio = '—') => fmt(x, 0, true, vazio);
  /** Inteiro se for inteiro; senão até 3 casas sem zeros à direita. */
  function fmt_auto(x, vazio = '—') {
    if (x === null || x === undefined || x === '' || !Number.isFinite(Number(x))) return vazio;
    const xf = Number(x);
    if (Math.abs(xf - Math.round(xf)) < 1e-9) return fmt(xf, 0);
    return fmt(xf, 3).replace(/0+$/, '').replace(/,$/, '');
  }
  /** Valor para campo de formulário: vírgula decimal, sem separador de milhar. */
  const fmt_campo = (x, vazio = '') => (x === null || x === undefined || x === '') ? vazio : fmt_auto(x).replace(/\./g, '').replace('−', '-');
  /** Notação científica: 1,84 × 10¹¹ */
  function fmt_sci(x, casas = 2, vazio = '—') {
    if (x === null || x === undefined || !Number.isFinite(Number(x))) return vazio;
    const xf = Number(x);
    if (xf === 0) return fmt(0, casas);
    const exp = Math.floor(Math.log10(Math.abs(xf)));
    const sup = String(exp).replace(/[-0-9]/g, c => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]);
    return `${fmt(xf / 10 ** exp, casas)} × 10${sup}`;
  }

  /** Lê '1234.5', '1234,5', '1.234,5', '1,234.5' e '45.000' (milhar brasileiro). */
  function ler_numero(valor, nome = 'valor', obrigatorio = true) {
    if (valor === null || valor === undefined) {
      if (obrigatorio) throw new ErroEntrada([`${nome}: campo obrigatório.`]);
      return null;
    }
    if (typeof valor === 'number') {
      if (Number.isFinite(valor)) return valor;
      throw new ErroEntrada([`${nome}: número inválido.`]);
    }
    let s = String(valor).replace(/[\s ]/g, '').replace('−', '-');
    if (s === '') {
      if (obrigatorio) throw new ErroEntrada([`${nome}: campo obrigatório.`]);
      return null;
    }
    if (s.includes(',') && s.includes('.')) {
      s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    } else if ((s.match(/\./g) || []).length > 1 || /^[-+]?[1-9]\d{0,2}\.\d{3}$/.test(s)) {
      s = s.replace(/\./g, '');
    }
    const n = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s) ? Number(s) : NaN;
    if (!Number.isFinite(n)) throw new ErroEntrada([`${nome}: '${valor}' não é um número válido.`]);
    return n;
  }

  /** Maiúsculas sem acentos e sem espaços duplicados (para comparar nomes). */
  function normalizar(s) {
    return String(s === null || s === undefined ? '' : s).normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^\x00-\x7f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
  }
  function ler_bool(v) {
    if (typeof v === 'boolean') return v;
    return ['S', 'SIM', 'Y', 'YES', 'TRUE', 'VERDADEIRO', '1', 'X'].includes(normalizar(v));
  }
  function achar_material(nome) {
    const n = normalizar(nome).replace(/^(AISI|SAE)\s*/, '').trim();
    if (n.startsWith('PERSONAL')) return MATERIAL_PERSONALIZADO;
    for (const m of Object.keys(MATERIAIS)) if (normalizar(m).replace(/^AISI\s*/, '') === n) return m;
    throw new ErroEntrada([`Material '${nome}' não cadastrado (use 1045, 1524, 8620, 4140, 4340 ou personalizado).`]);
  }
  function achar_aplicacao(nome) {
    const n = normalizar(nome);
    if (!n || n.startsWith('OUTRA') || ['MANUAL', 'NENHUMA', '-'].includes(n)) return APLICACAO_OUTRA;
    for (const a of Object.keys(APLICACOES)) if (normalizar(a) === n) return a;
    let cand = Object.keys(APLICACOES).filter(a => normalizar(a).startsWith(n) || normalizar(a).includes(n));
    if (cand.length === 1) return cand[0];
    const palavras = n.split(' ').map(w => w.slice(0, 5));
    cand = Object.keys(APLICACOES).filter(a => palavras.every(w => normalizar(a).split(' ').some(x => x.startsWith(w))));
    if (cand.length === 1) return cand[0];
    throw new ErroEntrada([`Aplicação '${nome}' não reconhecida.`]);
  }
  function achar_criterio(nome) {
    const n = normalizar(nome).replace(/[\s_/-]/g, '');
    if (['SECAO5', '5', '58', 'SECAO58', 'SECAO8', 'EQUACAO'].includes(n)) return 'SECAO_5';
    if (['SECAO9', '9', 'TABELAS'].includes(n)) return 'SECAO_9';
    if (['MAIOR', 'AMBOS', 'OSDOIS'].includes(n)) return 'MAIOR';
    if (['PERSONALIZADO', 'CUSTOM'].includes(n)) return 'PERSONALIZADO';
    throw new ErroEntrada([`Critério '${nome}' inválido (secao5, secao9, maior).`]);
  }

  // ════════════════════════════════════════════════════════════════════════
  // 2. Eixo — equações da seção 5 e auxiliares
  // ════════════════════════════════════════════════════════════════════════

  function rotacao_sincrona(frequencia, polos) { return 120.0 * frequencia / polos; }
  function coluna_rotacao_rotulo(f, p) { return `${f} Hz · ${p}p · ${fmt_int(rotacao_sincrona(f, p))} rpm`; }

  /** Seção 5: Mt [N·m] = 9550 · P [kW] / n [rpm] */
  function torque_nominal(p_kw, n_rpm) { return K_TORQUE * p_kw / n_rpm; }

  /** τ [MPa] usado na equação, conforme o critério. */
  function tensao_referencia(material, criterio, tau_personalizado = null) {
    if (criterio === 'SECAO_5') return material.tau_max;
    if (criterio === 'SECAO_9') return material.tau_secao9;
    if (criterio === 'PERSONALIZADO') {
      if (!tau_personalizado || tau_personalizado <= 0) throw new ErroEntrada(['Critério personalizado: informe τ (MPa) > 0.']);
      return Number(tau_personalizado);
    }
    throw new ErroEntrada([`Critério inválido: ${criterio}`]);
  }

  /** Seção 5: d [mm] = ∛( SF · Mt · FS · 1000 · 16 / (π · τ) ) */
  function diametro_minimo(mt_nm, fs, tau_mpa, sf = FATOR_SEGURANCA_PADRAO) {
    return Math.pow(sf * mt_nm * fs * 1000.0 * 16.0 / (Math.PI * tau_mpa), 1.0 / 3.0);
  }
  /** Inverso: maior Mt [N·m] que o diâmetro suporta com FS e SF. */
  function torque_admissivel(d_mm, fs, tau_mpa, sf = FATOR_SEGURANCA_PADRAO) {
    return Math.PI * tau_mpa * d_mm ** 3 / (sf * fs * 1000.0 * 16.0);
  }
  /** Seção 8: potência máxima [kW] para o diâmetro d na rotação n. */
  function potencia_maxima(d_mm, n_rpm, fs, tau_mpa, sf = FATOR_SEGURANCA_PADRAO) {
    return torque_admissivel(d_mm, fs, tau_mpa, sf) * n_rpm / K_TORQUE;
  }
  /** Cisalhamento por torção em eixo maciço: τ = 16·Mt/(π·d³) [MPa] */
  function tensao_torcao(mt_nm, d_mm) { return 16.0 * mt_nm * 1000.0 / (Math.PI * d_mm ** 3); }
  /** Menor diâmetro da série ≥ d_mín (null acima da série). */
  function selecionar_diametro(d_min, serie) {
    const ord = serie.slice().sort((a, b) => a - b);
    for (const d of ord) if (d >= d_min - 1e-9) return d;
    return null;
  }
  function diametro_especial(d_min, passo = 10) { return Math.ceil(d_min / passo - 1e-12) * passo; }
  /** Tolerância da ponta de eixo: k6 até 50 mm, m6 acima. */
  function tolerancia_iso(d_mm) { return d_mm <= 50 ? 'k6' : 'm6'; }
  function comprimento_ponta(d_mm) {
    return Math.abs(d_mm - Math.round(d_mm)) < 1e-9 ? (COMPRIMENTO_PONTA[Math.round(d_mm)] || null) : null;
  }
  function carcacas_iec(d_mm, polos = null) {
    for (const [d, , lista] of DADOS.HARMONIZACAO_IEC) {
      if (Math.abs(d - d_mm) < 1e-9) {
        const out = [];
        for (const [carc, pol] of lista) {
          if (polos === null || polos === undefined) {
            out.push(carc + (pol === null ? '' : (pol === '2' ? ' (somente 2 polos)' : ' (demais polaridades)')));
          } else if (pol === null || (pol === '2' && polos === 2) || (pol === 'demais' && polos !== 2)) {
            out.push(carc);
          }
        }
        return out;
      }
    }
    return [];
  }
  function menor_ponta_iec(d_min, polos = null) {
    for (const [d, tol] of DADOS.HARMONIZACAO_IEC) if (d >= d_min - 1e-9) return [d, tol, carcacas_iec(d, polos)];
    return null;
  }
  function secao_tabela8(material, fs) {
    const i = ORDEM_MATERIAIS_DOC.indexOf(material);
    if (i < 0) return null;
    const j = DADOS.FS_TABELAS_SECAO8.findIndex(f => Math.abs(f - fs) < 1e-9);
    return j < 0 ? null : `8.${i + 1}.${j + 1}`;
  }
  function secao_tabela9(aplicacao, material) {
    const i = DADOS.ORDEM_APLICACOES_SECAO9.indexOf(aplicacao), j = ORDEM_MATERIAIS_DOC.indexOf(material);
    return (i < 0 || j < 0) ? null : `9.${i + 1}.${j + 1}`;
  }
  function errata_aplicavel(material, fs, p_linha) {
    if (material === 'AISI 1045' && Math.abs(fs - 3.0) < 1e-9 && p_linha !== null && p_linha >= 1580) return 'E1';
    if (material === 'AISI 8620' && Math.abs(fs - 2.0) < 1e-9) return 'E2';
    return null;
  }
  /** Reproduz o valor IMPRESSO nas tabelas da seção 9, inclusive as erratas E1 e E2. */
  function valor_tabela9_documento(material, fs, p_kw, n_rpm) {
    let tau = material.tau_secao9, fs_doc = fs;
    if (material.nome === 'AISI 1045' && Math.abs(fs - 3.0) < 1e-9 && p_kw >= 1580) tau = material.escoamento / 2.0;
    if (material.nome === 'AISI 8620' && Math.abs(fs - 2.0) < 1e-9) fs_doc = 2.5;
    return Math.round(diametro_minimo(torque_nominal(p_kw, n_rpm), fs_doc, tau));
  }
  /** Seção 8: matriz [diâmetro][rotação] de potência máxima (kW). */
  function tabela_potencia_maxima(material, fs, criterio = 'SECAO_5', diametros = DIAMETROS_SECAO8,
    rotacoes = ROTACOES_COLUNAS, sf = FATOR_SEGURANCA_PADRAO, tau_personalizado = null) {
    const tau = tensao_referencia(material, criterio !== 'MAIOR' ? criterio : 'SECAO_9', tau_personalizado);
    return diametros.map(d => rotacoes.map(n => potencia_maxima(d, n, fs, tau, sf)));
  }
  /** Seção 9: matriz [potência][rotação] de diâmetro mínimo (mm, sem arredondar). */
  function tabela_diametro_minimo(material, fs, criterio = 'SECAO_9', potencias = POTENCIAS_SECAO9,
    rotacoes = ROTACOES_COLUNAS, sf = FATOR_SEGURANCA_PADRAO, tau_personalizado = null) {
    const tau = tensao_referencia(material, criterio !== 'MAIOR' ? criterio : 'SECAO_9', tau_personalizado);
    return potencias.map(p => rotacoes.map(n => diametro_minimo(torque_nominal(p, n), fs, tau, sf)));
  }
  /** Série de potências no padrão da seção 9 (R25 arredondada) entre p_ini e p_fim. */
  function serie_potencias(p_ini = 1000.0, p_fim = 100000.0) {
    const out = [];
    const k0 = Math.floor(25 * Math.log10(Math.max(p_ini, 1e-9))) - 1;
    const k1 = Math.ceil(25 * Math.log10(Math.max(p_fim, 1e-9))) + 1;
    for (let k = k0; k <= k1; k++) {
      let v = 10 ** (k / 25);
      if (v >= 1000) v = Math.round(v / 10) * 10;
      else if (v >= 100) v = Math.round(v);
      else if (v >= 10) v = Math.round(v * 10) / 10;
      else v = Math.round(v * 100) / 100;
      if (v >= p_ini - 1e-9 && v <= p_fim + 1e-9 && (!out.length || v !== out[out.length - 1])) out.push(v);
    }
    return out;
  }

  // ── Entrada ────────────────────────────────────────────────────────────────
  const ENTRADA_PADRAO = Object.freeze({
    projeto: '', equipamento: '', responsavel: '',
    tipo_maquina: 'Gerador', potencia: null, unidade_potencia: 'kW', converter_kva: false, cos_phi: 0.80,
    rendimento: 0.97, modo_rotacao: 'polos', frequencia: 60.0, polos: 4, escorregamento: 0.0, rotacao: null,
    aplicacao: 'GERADORES', fs_personalizado: null, material: 'AISI 1045', mat_escoamento: null, mat_ruptura: null,
    mat_temp_min: null, mat_soldavel: false, criterio: CRITERIO_PADRAO, tau_personalizado: null,
    fator_seguranca: FATOR_SEGURANCA_PADRAO, serie_diametros: SERIE_PADRAO, temp_min_operacao: null,
    requer_solda: false, diametro_existente: null, torque_pico_pu: null, categoria_motor: '',
    mancal_ativo: true, mancal_diametro: null, mancal_largura: null, mancal_bd: MANCAL_BD_PADRAO, mancal_carga: null,
    mancal_massa_rotor: null, mancal_fracao: 50.0, mancal_fator_carga: 1.0, mancal_vg: null, mancal_psi: null,
    mancal_modo_temp: 'informada', mancal_temp_efetiva: T_EFETIVA_PADRAO, mancal_area_caixa: null,
    mancal_alfa: ALFA_CAIXA_PADRAO, mancal_temp_ambiente: T_AMBIENTE_PADRAO, mancal_volume_oleo: VOLUME_OLEO_PADRAO,
    mancal_p_lim: P_LIM_PADRAO, mancal_t_lim: T_LIM_PADRAO
  });
  function entrada(dados = {}) {
    const e = Object.assign({}, ENTRADA_PADRAO);
    for (const k of Object.keys(dados)) if (k in ENTRADA_PADRAO) e[k] = dados[k];
    if (e.polos !== null && e.polos !== undefined && Number.isFinite(Number(e.polos))) e.polos = Math.round(Number(e.polos));
    return e;
  }

  function obter_material(e) {
    if (e.material === MATERIAL_PERSONALIZADO) {
      if (!e.mat_escoamento || e.mat_escoamento <= 0)
        throw new ErroEntrada(['Material personalizado: informe o limite de escoamento Se (MPa) > 0.']);
      const tau_max = e.mat_escoamento / Math.sqrt(3.0);
      return criarMaterial({ nome: MATERIAL_PERSONALIZADO, ruptura: e.mat_ruptura ? e.mat_ruptura : NaN,
        escoamento: Number(e.mat_escoamento), tau_max, tau_adm: tau_max / 1.5,
        temp_min: (e.mat_temp_min !== null && e.mat_temp_min !== undefined) ? e.mat_temp_min : NaN,
        soldavel: !!e.mat_soldavel, observacao: 'τmáx = Se/√3', personalizado: true });
    }
    if (!(e.material in MATERIAIS)) throw new ErroEntrada([`Material '${e.material}' não cadastrado.`]);
    return MATERIAIS[e.material];
  }

  /** Converte a potência informada para kW no eixo. Retorna [kW, descrição, regra]. */
  function potencia_calculo(e) {
    const p = e.potencia, u = e.unidade_potencia;
    if (u === 'kW') return [p, `P = ${fmt_auto(p)} kW`, 'kW'];
    if (u === 'MW') return [p * 1000.0, `P = ${fmt_auto(p)} MW × 1000 = ${fmt(p * 1000, 1)} kW`, 'MW'];
    if (u === 'cv') return [p * KW_POR_CV, `P = ${fmt_auto(p)} cv × 0,7355 = ${fmt(p * KW_POR_CV, 2)} kW`, 'cv'];
    if (u === 'HP') return [p * KW_POR_HP, `P = ${fmt_auto(p)} HP × 0,7457 = ${fmt(p * KW_POR_HP, 2)} kW`, 'HP'];
    if (u === 'kVA' || u === 'MVA') {
      const s_kva = p * (u === 'MVA' ? 1000.0 : 1.0);
      const pref = u === 'MVA' ? `S = ${fmt_auto(p)} MVA = ${fmt(s_kva, 1)} kVA; ` : '';
      if (!e.converter_kva)
        return [s_kva, pref + `P = ${fmt(s_kva, 1)} kW  (S = ${fmt(s_kva, 1)} kVA tratado como kW — convenção das tabelas da seção 9, lado conservador)`, 'kva_convencao'];
      if (e.tipo_maquina === 'Gerador') {
        const pk = s_kva * e.cos_phi / e.rendimento;
        return [pk, pref + `P eixo = S·cosφ/η = ${fmt(s_kva, 1)} × ${fmt(e.cos_phi, 3)} / ${fmt(e.rendimento, 3)} = ${fmt(pk, 1)} kW (potência de acionamento do gerador)`, 'kva_gerador'];
      }
      if (e.tipo_maquina === 'Motor') {
        const pk = s_kva * e.cos_phi * e.rendimento;
        return [pk, pref + `P eixo = S·cosφ·η = ${fmt(s_kva, 1)} × ${fmt(e.cos_phi, 3)} × ${fmt(e.rendimento, 3)} = ${fmt(pk, 1)} kW (potência no eixo do motor)`, 'kva_motor'];
      }
      const pk = s_kva * e.cos_phi;
      return [pk, pref + `P = S·cosφ = ${fmt(s_kva, 1)} × ${fmt(e.cos_phi, 3)} = ${fmt(pk, 1)} kW`, 'kva_outro'];
    }
    throw new ErroEntrada([`Unidade de potência inválida: ${u}`]);
  }
  function rotacao_calculo(e) {
    if (e.modo_rotacao === 'rpm') return [Number(e.rotacao), `n = ${fmt_auto(e.rotacao)} rpm (informada)`];
    const ns = rotacao_sincrona(e.frequencia, e.polos);
    if (e.escorregamento) {
      const n = ns * (1 - e.escorregamento / 100.0);
      return [n, `ns = 120·f/p = 120 × ${fmt_auto(e.frequencia)} / ${e.polos} = ${fmt(ns, 1)} rpm;  n = ns·(1 − s) = ${fmt(ns, 1)} × (1 − ${fmt_auto(e.escorregamento)}%) = ${fmt(n, 1)} rpm`];
    }
    return [ns, `n = 120·f/p = 120 × ${fmt_auto(e.frequencia)} / ${e.polos} = ${fmt(ns, 1)} rpm (síncrona)`];
  }
  function fator_servico(e) {
    if (e.fs_personalizado !== null && e.fs_personalizado !== undefined) {
      if (e.aplicacao in APLICACOES && Math.abs(APLICACOES[e.aplicacao] - e.fs_personalizado) > 1e-9)
        return [e.fs_personalizado, `FS = ${fmt_auto(e.fs_personalizado)} (informado; a tabela 6.2.7 indica ${fmt_auto(APLICACOES[e.aplicacao])} para ${e.aplicacao})`];
      return [e.fs_personalizado, `FS = ${fmt_auto(e.fs_personalizado)} (informado pelo usuário)`];
    }
    if (e.aplicacao in APLICACOES) {
      const fs = APLICACOES[e.aplicacao];
      return [fs, `FS = ${fmt_auto(fs)} — ${e.aplicacao} (tabela 6.2.7, regime contínuo 24 h/dia)`];
    }
    throw new ErroEntrada(["Aplicação 'OUTRA': informe o fator de serviço (FS)."]);
  }

  /** Retorna [erros, avisos] — mesmas regras do programa Python. */
  function validar(e) {
    const erros = [], avisos = [];
    const vazio = x => x === null || x === undefined;
    if (vazio(e.potencia) || !(e.potencia > 0)) erros.push('Potência: informe um valor maior que zero.');
    else if (e.potencia > 5e6) erros.push('Potência fora da faixa plausível.');
    if (!UNIDADES_POTENCIA.includes(e.unidade_potencia)) erros.push(`Unidade de potência inválida (${e.unidade_potencia}).`);
    if ((e.unidade_potencia === 'kVA' || e.unidade_potencia === 'MVA') && e.converter_kva) {
      if (!(0 < (e.cos_phi || 0) && (e.cos_phi || 0) <= 1)) erros.push('cos φ deve estar entre 0 e 1.');
      if (!(0 < (e.rendimento || 0) && (e.rendimento || 0) <= 1)) erros.push('Rendimento η deve estar entre 0 e 1.');
    }
    if (e.modo_rotacao === 'rpm') {
      if (vazio(e.rotacao) || !(e.rotacao > 0)) erros.push('Rotação: informe um valor em rpm maior que zero.');
      else if (e.rotacao > 1e5) erros.push('Rotação fora da faixa plausível.');
    } else {
      if (!e.frequencia || e.frequencia <= 0) erros.push('Frequência deve ser maior que zero.');
      if (!Number.isInteger(e.polos) || e.polos < 2 || e.polos % 2) erros.push('Número de polos deve ser inteiro, par e ≥ 2.');
      if (!(0 <= (e.escorregamento || 0) && (e.escorregamento || 0) < 50)) erros.push('Escorregamento deve estar entre 0 e 50%.');
    }
    if (!(e.aplicacao in APLICACOES) && vazio(e.fs_personalizado)) erros.push("Aplicação 'OUTRA': informe o fator de serviço (FS).");
    if (!vazio(e.fs_personalizado)) {
      if (e.fs_personalizado <= 0) erros.push('Fator de serviço deve ser maior que zero.');
      else if (e.fs_personalizado < 1) avisos.push(`FS = ${fmt_auto(e.fs_personalizado)} < 1: abaixo dos valores usuais da tabela 6.2.7.`);
    }
    if (e.material === MATERIAL_PERSONALIZADO && !(e.mat_escoamento && e.mat_escoamento > 0))
      erros.push('Material personalizado: informe o escoamento Se (MPa).');
    else if (e.material !== MATERIAL_PERSONALIZADO && !(e.material in MATERIAIS)) erros.push(`Material '${e.material}' não cadastrado.`);
    if (!(e.criterio in CRITERIOS)) erros.push(`Critério inválido (${e.criterio}).`);
    if (e.criterio === 'PERSONALIZADO' && !(e.tau_personalizado && e.tau_personalizado > 0)) erros.push('Critério personalizado: informe τ (MPa) > 0.');
    if (!e.fator_seguranca || e.fator_seguranca <= 0) erros.push('Fator de segurança deve ser maior que zero.');
    else if (e.fator_seguranca < FATOR_SEGURANCA_PADRAO - 1e-9)
      avisos.push(`Fator de segurança ${fmt_auto(e.fator_seguranca)} abaixo do mínimo ${fmt_auto(FATOR_SEGURANCA_PADRAO)} exigido na seção 5.`);
    if (!vazio(e.diametro_existente) && e.diametro_existente <= 0) erros.push('Diâmetro existente deve ser maior que zero.');
    if (!vazio(e.torque_pico_pu) && e.torque_pico_pu <= 0) erros.push('Torque de pico deve ser maior que zero (múltiplo do nominal).');
    if (!(e.serie_diametros in SERIES_DIAMETROS)) erros.push(`Série de diâmetros inválida (${e.serie_diametros}).`);
    return [erros, avisos];
  }

  // ════════════════════════════════════════════════════════════════════════
  // 3. Cálculo completo do eixo
  // ════════════════════════════════════════════════════════════════════════
  function calcular(dados) {
    const e = entrada(dados);
    const [erros, avisos] = validar(e);
    if (erros.length) throw new ErroEntrada(erros);
    const notas = [];
    const mat = obter_material(e);
    const [p_kw, p_txt, p_regra] = potencia_calculo(e);
    const [n, n_txt] = rotacao_calculo(e);
    const [fs, fs_txt] = fator_servico(e);
    const sf = Number(e.fator_seguranca);
    const serie = SERIES_DIAMETROS[e.serie_diametros];
    const polos = e.modo_rotacao === 'polos' ? e.polos : null;
    const mt = torque_nominal(p_kw, n);

    // Diâmetro por critério (sempre seção 5/8 e seção 9, para comparação)
    const lista = ['SECAO_5', 'SECAO_9'].concat(e.criterio === 'PERSONALIZADO' ? ['PERSONALIZADO'] : []);
    const por_criterio = {};
    for (const c of lista) {
      const tau = tensao_referencia(mat, c, e.tau_personalizado);
      const d_min = diametro_minimo(mt, fs, tau, sf);
      let d_norm = selecionar_diametro(d_min, serie);
      const especial = d_norm === null;
      if (especial) d_norm = diametro_especial(d_min);
      const p_max_norm = potencia_maxima(d_norm, n, fs, tau, sf);
      por_criterio[c] = { criterio: c, tau, d_min, d_norm, d_norm_especial: especial, p_max_norm, utilizacao_norm: p_kw / p_max_norm };
    }
    const governante = e.criterio === 'MAIOR'
      ? (por_criterio.SECAO_5.d_min >= por_criterio.SECAO_9.d_min ? 'SECAO_5' : 'SECAO_9') : e.criterio;
    const rc = por_criterio[governante];
    const tau_ref = rc.tau;

    let d_ad, d_ad_origem;
    if (e.diametro_existente) { d_ad = Number(e.diametro_existente); d_ad_origem = 'informado (verificação)'; }
    else { d_ad = rc.d_norm; d_ad_origem = !rc.d_norm_especial ? 'normalizado ' + e.serie_diametros : 'especial (acima da série)'; }

    const tau_nom = tensao_torcao(mt, d_ad);
    const tau_serv = tau_nom * fs;
    const sf_real = tau_ref / tau_serv;
    const util = (rc.d_min / d_ad) ** 3;
    const p_max = potencia_maxima(d_ad, n, fs, tau_ref, sf);
    const mt_max = torque_admissivel(d_ad, fs, tau_ref, sf);

    // ── verificações
    let status = 'ok';
    let verif_ex = null;
    if (e.diametro_existente) {
      const atende = d_ad >= rc.d_min - 1e-9;
      verif_ex = { d: d_ad, atende, falta: Math.max(0, rc.d_min - d_ad), sf_real, utilizacao: util, p_max,
        normalizado: serie.some(x => Math.abs(d_ad - x) < 1e-9) };
      if (!atende) {
        status = 'falha';
        avisos.push(`Diâmetro existente ${fmt(d_ad, 1)} mm NÃO atende: mínimo ${fmt(rc.d_min, 1)} mm (faltam ${fmt(rc.d_min - d_ad, 1)} mm). Potência máxima admissível ${fmt(p_max, 0)} kW = ${fmt(100 * p_max / p_kw, 1)}% da potência de cálculo.`);
      }
      if (!verif_ex.normalizado) notas.push(`O diâmetro ${fmt(d_ad, 1)} mm não pertence à série ${e.serie_diametros}.`);
    }
    let verif_pico = null;
    if (e.torque_pico_pu) {
      const mt_pico = e.torque_pico_pu * mt;
      const tau_pico = tensao_torcao(mt_pico, d_ad);
      const tau_esc = mat.tau_escoamento;
      const margem = tau_esc / tau_pico;
      verif_pico = { k: e.torque_pico_pu, mt_pico, tau_pico, tau_esc, margem, atende: margem >= 1.0 };
      if (margem < 1.0) {
        if (status === 'ok') status = 'atencao';
        avisos.push(`Torque de pico ${fmt_auto(e.torque_pico_pu)}×Mt gera τ = ${fmt(tau_pico, 1)} MPa > τ escoamento (Se/√3) = ${fmt(tau_esc, 1)} MPa — risco de deformação permanente (verificação complementar).`);
      }
    }
    const tmin_op = e.temp_min_operacao;
    if (tmin_op !== null && tmin_op !== undefined && !Number.isNaN(mat.temp_min)) {
      if (tmin_op < mat.temp_min) {
        if (status === 'ok') status = 'atencao';
        const ok_t = Object.values(MATERIAIS).filter(m => m.temp_min <= tmin_op).map(m => m.nome);
        avisos.push(`${mat.nome} é indicado até ${fmt_int(mat.temp_min)} °C; temperatura mínima de operação ${fmt_auto(tmin_op)} °C. ` +
          (ok_t.length ? `Materiais adequados: ${ok_t.join(', ')}.` : 'Nenhum material da tabela atende essa temperatura.'));
      }
    }
    if (e.requer_solda && !mat.soldavel) {
      if (status === 'ok') status = 'atencao';
      const ok_s = Object.values(MATERIAIS).filter(m => m.soldavel).map(m => m.nome);
      avisos.push(`${mat.nome} não é soldável (seção 4). Para eixo soldado (ex.: spider arm) use: ${ok_s.join(', ')}.`);
    }
    if (e.requer_solda && tmin_op !== null && tmin_op !== undefined) {
      const ambos = Object.values(MATERIAIS).filter(m => m.soldavel && m.temp_min <= tmin_op);
      if (!ambos.length) avisos.push(`Nenhum material da tabela é simultaneamente soldável e adequado para ${fmt_auto(tmin_op)} °C — consultar a engenharia de materiais.`);
    }
    if (avisos.some(a => a.startsWith('Fator de segurança')) && status === 'ok') status = 'atencao';

    if (rc.d_norm_especial)
      notas.push(`d mín = ${fmt(rc.d_min, 1)} mm está acima da série ${e.serie_diametros} (máx. ${Math.max(...serie)} mm): adotado diâmetro especial ${fmt_int(rc.d_norm)} mm (múltiplo de 10).`);
    if (!(POTENCIAS_SECAO9[0] <= p_kw && p_kw <= POTENCIAS_SECAO9[POTENCIAS_SECAO9.length - 1]))
      notas.push('Potência fora da faixa das tabelas da seção 9 (1.000 a 100.000 kW): resultado obtido diretamente pela equação da seção 5 (válido para qualquer potência).');
    if (rc.d_min < DIAMETROS_SECAO8[0])
      notas.push('Diâmetro abaixo da faixa das tabelas da seção 8 (110 a 630 mm): seleção feita na série DIN 748-1 completa; veja também a harmonização IEC (seção 7).');
    if (!ROTACOES_COLUNAS.some(r => Math.abs(n - r) < 0.5))
      notas.push(`Rotação ${fmt(n, 1)} rpm não coincide com as colunas das tabelas (3600…500 rpm): use o cálculo direto (já considerado aqui).`);

    const status_texto = e.diametro_existente
      ? { ok: 'DIÂMETRO EXISTENTE ATENDE', atencao: 'ATENDE COM RESSALVAS', falha: 'DIÂMETRO EXISTENTE NÃO ATENDE' }[status]
      : { ok: 'DIMENSIONADO — ATENDE', atencao: 'DIMENSIONADO COM RESSALVAS', falha: 'NÃO ATENDE' }[status];

    // ── comparação entre materiais (critério governante)
    const crit_comp = governante !== 'PERSONALIZADO' ? governante : 'SECAO_5';
    const mats = Object.values(MATERIAIS).concat(mat.personalizado ? [mat] : []);
    const comparacao = mats.map(m => {
      const tau_m = tensao_referencia(m, crit_comp, e.tau_personalizado);
      const dmin_m = diametro_minimo(mt, fs, tau_m, sf);
      let dn_m = selecionar_diametro(dmin_m, serie);
      if (dn_m === null) dn_m = diametro_especial(dmin_m);
      const pm_m = potencia_maxima(dn_m, n, fs, tau_m, sf);
      const at_t = tmin_op === null || tmin_op === undefined || Number.isNaN(m.temp_min) || tmin_op >= m.temp_min;
      const at_s = !e.requer_solda || m.soldavel;
      return { material: m.nome, escoamento: m.escoamento, tau: tau_m, d_min: dmin_m, d_norm: dn_m, p_max_norm: pm_m,
        utilizacao: p_kw / pm_m, temp_min: m.temp_min, soldavel: m.soldavel, atende_temp: at_t, atende_solda: at_s,
        melhor: false, selecionado: m.nome === mat.nome };
    });
    const elegiveis = comparacao.filter(c => c.atende_temp && c.atende_solda);
    if (elegiveis.length) {
      const dmin_el = Math.min(...elegiveis.map(c => c.d_norm));
      for (const c of elegiveis) if (Math.abs(c.d_norm - dmin_el) < 1e-9) c.melhor = true;
    }

    // ── equivalência com as tabelas do documento
    let consulta_tab8 = null;
    const sec8 = secao_tabela8(mat.nome, fs);
    const colIdx = ROTACOES_COLUNAS.findIndex(r => Math.abs(r - n) < 0.5);
    const col = colIdx >= 0 ? colIdx : null;
    if (sec8 && col !== null) {
      let achado = null;
      for (const d of DIAMETROS_SECAO8) {
        const pmx = Math.round(potencia_maxima(d, ROTACOES_COLUNAS[col], fs, mat.tau_max, FATOR_SEGURANCA_PADRAO));
        if (pmx >= p_kw - 1e-9) { achado = [d, pmx]; break; }
      }
      consulta_tab8 = { secao: sec8, coluna: coluna_rotacao_rotulo(...COLUNAS_ROTACAO[col]), coluna_idx: col,
        d: achado ? achado[0] : null, p_max: achado ? achado[1] : null,
        abaixo: achado !== null && achado[0] === DIAMETROS_SECAO8[0] && por_criterio.SECAO_5.d_min < DIAMETROS_SECAO8[0] };
    }
    let consulta_tab9 = null;
    if (e.aplicacao in APLICACOES && Math.abs(APLICACOES[e.aplicacao] - fs) < 1e-9) {
      const sec9 = secao_tabela9(e.aplicacao, mat.nome);
      if (sec9) {
        const linha = POTENCIAS_SECAO9.find(p => p >= p_kw - 1e-9);
        if (linha !== undefined && p_kw >= POTENCIAS_SECAO9[0] - 1e-9) {
          let n_col = null, rot_col = null, conservador, idx = null;
          if (col !== null) { n_col = ROTACOES_COLUNAS[col]; rot_col = coluna_rotacao_rotulo(...COLUNAS_ROTACAO[col]); conservador = false; idx = col; }
          else {
            const menores = ROTACOES_COLUNAS.filter(r => r <= n);
            n_col = menores.length ? Math.max(...menores) : null;
            idx = n_col ? ROTACOES_COLUNAS.indexOf(n_col) : null;
            rot_col = n_col ? coluna_rotacao_rotulo(...COLUNAS_ROTACAO[idx]) : null;
            conservador = true;
          }
          if (n_col) {
            const d_tab = Math.round(diametro_minimo(torque_nominal(linha, n_col), fs, mat.tau_secao9));
            consulta_tab9 = { secao: sec9, linha, coluna: rot_col, coluna_idx: idx, d: d_tab,
              d_doc: valor_tabela9_documento(mat, fs, linha, n_col), errata: errata_aplicavel(mat.nome, fs, linha), conservador };
          }
        }
      }
    }
    const grupos = DADOS.TIPOS_CARGA.filter(g => (DADOS.APLICACAO_GRUPO_CARGA[e.aplicacao] || []).includes(g.grupo));

    // Diâmetro imediatamente inferior da série (para a memória de cálculo)
    const abaixo = serie.filter(x => x < rc.d_min);
    const d_inferior = abaixo.length ? Math.max(...abaixo) : null;
    const p_inferior = d_inferior ? potencia_maxima(d_inferior, n, fs, tau_ref, sf) : null;

    if ((e.unidade_potencia === 'kVA' || e.unidade_potencia === 'MVA') && !e.converter_kva)
      notas.push("Potência em kVA usada diretamente como kW (convenção das tabelas da seção 9). Para usar a potência mecânica real, marque 'converter kVA → kW'.");
    if (governante === 'SECAO_5' && e.criterio !== 'PERSONALIZADO') {
      const r9 = por_criterio.SECAO_9;
      notas.push(`Pelo critério das tabelas da seção 9 o diâmetro seria ${fmt(r9.d_min, 1)} mm → ${fmt_int(r9.d_norm)} mm (+${fmt(100 * (r9.d_min / rc.d_min - 1), 1)}%).`);
    } else if (governante === 'SECAO_9') {
      const r5 = por_criterio.SECAO_5;
      notas.push(`Pela equação da seção 5 (tabelas da seção 8) o diâmetro seria ${fmt(r5.d_min, 1)} mm → ${fmt_int(r5.d_norm)} mm (${fmt(100 * (r5.d_min / rc.d_min - 1), 1)}%).`);
    }
    if (e.categoria_motor && e.categoria_motor in CATEGORIAS_MOTOR)
      notas.push(`Categoria ${e.categoria_motor} (NBR 7094): ${CATEGORIAS_MOTOR[e.categoria_motor]}`);

    const r = {
      entrada: e, material: mat, p_kw, p_origem: p_txt, p_regra, n_rpm: n, n_origem: n_txt,
      n_sincrona: e.modo_rotacao === 'polos' ? rotacao_sincrona(e.frequencia, e.polos) : null,
      fs, fs_origem: fs_txt, sf, mt, criterio: e.criterio, criterio_governante: governante, por_criterio,
      d_min: rc.d_min, d_norm: rc.d_norm, d_norm_especial: rc.d_norm_especial, d_adotado: d_ad, d_adotado_origem: d_ad_origem,
      tolerancia: tolerancia_iso(d_ad), comprimento: comprimento_ponta(d_ad), iec_carcacas: carcacas_iec(d_ad, polos),
      iec_menor: rc.d_min <= 100 ? menor_ponta_iec(rc.d_min, polos) : null, tau_ref, tau_nominal: tau_nom,
      tau_servico: tau_serv, sf_real, utilizacao: util, p_max, mt_max, status, status_texto, verif_existente: verif_ex,
      verif_pico, comparacao, consulta_tab8, consulta_tab9, grupo_carga: grupos, d_inferior, p_inferior,
      avisos, notas, mancal: null, mancal_erro: ''
    };
    if (e.mancal_ativo) {
      try {
        r.mancal = calcular_mancal(e, n, d_ad);
      } catch (ex) {
        r.mancal_erro = ex instanceof ErroEntrada
          ? ex.erros.join(' · ').replace(/Mancal: /g, '')
          : `dados do mancal inválidos (${ex && ex.message ? ex.message : ex})`;
      }
    }
    return r;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 4. Mancal de deslizamento — característica (Reynolds), óleo e tabelas
  // ════════════════════════════════════════════════════════════════════════

  function pchipDerivadas(xs, ys) {
    const n = xs.length, h = [], d = [], m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) { h.push(xs[i + 1] - xs[i]); d.push((ys[i + 1] - ys[i]) / h[i]); }
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) m[i] = 0;
      else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
    }
    return m;
  }
  const PCHIP_CACHE = new Map();
  function bisectRight(xs, x) {
    let lo = 0, hi = xs.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (x < xs[mid]) hi = mid; else lo = mid + 1; }
    return lo;
  }
  function pchip(xs, ys, x, chave) {
    let m = PCHIP_CACHE.get(chave);
    if (!m) { m = pchipDerivadas(xs, ys); PCHIP_CACHE.set(chave, m); }
    if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0]);
    const u = xs.length - 1;
    if (x >= xs[u]) return ys[u] + m[u] * (x - xs[u]);
    const i = bisectRight(xs, x) - 1;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h;
    return (1 + 2 * t) * (1 - t) ** 2 * ys[i] + t * (1 - t) ** 2 * h * m[i] + t * t * (3 - 2 * t) * ys[i + 1] + t * t * (t - 1) * h * m[i + 1];
  }
  function linhaBD(bd) {
    const lb = Math.log(Math.min(Math.max(bd, MANCAL_BD[0]), MANCAL_BD[MANCAL_BD.length - 1]));
    const j = Math.min(Math.max(bisectRight(LOG_BD, lb) - 1, 0), LOG_BD.length - 2);
    return [j, (lb - LOG_BD[j]) / (LOG_BD[j + 1] - LOG_BD[j])];
  }
  /** So(ε, B/D) — cúbica monotônica em ε, linear em log B/D (tabela de Reynolds). */
  function sommerfeld_de_eps(eps, bd) {
    if (eps <= 0) return 0;
    const [j, w] = linhaBD(bd);
    const ls = (k, x) => pchip(MANCAL_EPS, LOG_SO[k], x, 'so' + k);
    if (eps < MANCAL_EPS[0]) {
      const s0 = Math.exp((1 - w) * ls(j, MANCAL_EPS[0]) + w * ls(j + 1, MANCAL_EPS[0]));
      return s0 * eps / MANCAL_EPS[0];
    }
    return Math.exp((1 - w) * ls(j, eps) + w * ls(j + 1, eps));
  }
  /** Ângulo de posição β [graus] entre a direção da carga e a linha de centros. */
  function beta_de_eps(eps, bd) {
    const [j, w] = linhaBD(bd);
    const b = (k, x) => pchip(MANCAL_EPS, DADOS.MANCAL_BETA[k], x, 'beta' + k);
    if (eps < MANCAL_EPS[0]) {
      const b0 = (1 - w) * b(j, MANCAL_EPS[0]) + w * b(j + 1, MANCAL_EPS[0]);
      return 90.0 + (b0 - 90.0) * Math.max(eps, 0) / MANCAL_EPS[0];
    }
    const x = Math.min(eps, MANCAL_EPS[MANCAL_EPS.length - 1]);
    return (1 - w) * b(j, x) + w * b(j + 1, x);
  }
  /** Inverte So(ε): [ε, limitado] — limitado = So exige ε > 0,99 (atrito misto). */
  function eps_de_sommerfeld(so, bd) {
    if (so <= 0) return [0, false];
    const eFim = MANCAL_EPS[MANCAL_EPS.length - 1];
    const sLo = sommerfeld_de_eps(MANCAL_EPS[0], bd);
    if (so <= sLo) return [so / sLo * MANCAL_EPS[0], false];
    if (so >= sommerfeld_de_eps(eFim, bd)) return [eFim, true];
    let a = MANCAL_EPS[0], b = eFim;
    for (let i = 0; i < 60; i++) { const m = 0.5 * (a + b); if (sommerfeld_de_eps(m, bd) < so) a = m; else b = m; }
    return [0.5 * (a + b), false];
  }

  function densidade_oleo(vg, t) { return OLEOS[vg].rho15 * (1 - COEF_DILATACAO_OLEO * (t - 15.0)); }
  /** [η Pa·s, ν mm²/s, ρ kg/m³] a t °C — ASTM D341 (Walther) entre ν40 = VG e ν100 típica. */
  function viscosidade_oleo(vg, t) {
    if (!(vg in OLEOS)) throw new ErroEntrada([`ISO VG ${vg} não cadastrado.`]);
    const nu40 = Number(vg), nu100 = OLEOS[vg].nu100;
    const t1 = Math.log10(313.15), t2 = Math.log10(373.15);
    const y1 = Math.log10(Math.log10(nu40 + 0.7)), y2 = Math.log10(Math.log10(nu100 + 0.7));
    const b = (y1 - y2) / (t2 - t1), a = y1 + b * t1;
    let nu = 10 ** (10 ** (a - b * Math.log10(t + 273.15))) - 0.7;
    if (Math.abs(t - 40.0) < 1e-12) nu = nu40;
    const rho = densidade_oleo(vg, t);
    return [nu * 1e-6 * rho, nu, rho];
  }
  function velocidade_periferica(d_mm, n_rpm) { return Math.PI * d_mm / 1000.0 * n_rpm / 60.0; }
  /** [h lim mm, fator de diâmetro, fator de velocidade] */
  function h_lim_tabela(d_mm, v) {
    const fd = d_mm <= 63 ? 1 : d_mm <= 160 ? 2 : d_mm < 400 ? 3 : d_mm <= 1000 ? 4 : d_mm <= 2500 ? 5 : 6;
    const fv = v <= 0.3 ? 2 : v <= 3 ? 3 : v <= 10 ? 4 : v <= 30 ? 5 : 6;
    return [DADOS.H_LIM_TABELA[fd][fv - 2], fd, fv];
  }
  /** [ψm ‰ ou null, fator de diâmetro, fator de velocidade] */
  function psi_tabela(d_mm, v) {
    const fdm = d_mm <= 100 ? 1 : d_mm <= 250 ? 2 : d_mm <= 500 ? 3 : 4;
    const fm = v <= 3 ? 2 : v <= 10 ? 3 : v <= 25 ? 4 : v <= 50 ? 5 : 6;
    return [DADOS.PSI_TABELA[fdm][fm - 2], fdm, fm];
  }
  function it7_furo(d_mm) {
    for (const [lim, it] of DADOS.IT7_FURO) if (d_mm <= lim + 1e-9) return it;
    throw new ErroEntrada(['Diâmetro acima da tabela H7 (2.000 mm).']);
  }
  /** [folga diametral mínima, máxima] mm para D e ψm da série. */
  function folgas_tabela(d_mm, psi_permil) {
    if (!(MANCAL_D_MIN < d_mm && d_mm <= MANCAL_D_MAX + 1e-9))
      throw new ErroEntrada([`Diâmetro do mancal fora das tabelas de folga (${fmt_int(MANCAL_D_MIN)} a ${fmt_int(MANCAL_D_MAX)} mm).`]);
    const j = PSI_SERIE.findIndex(s => Math.abs(s - psi_permil) < 1e-9);
    if (j < 0) throw new ErroEntrada([`ψ = ${fmt_auto(psi_permil)} ‰ não pertence à série das tabelas de folga (${PSI_SERIE.map(x => fmt_auto(x)).join(', ')} ‰).`]);
    const smax = DADOS.FOLGA_MAX_TABELA.find(([lim]) => d_mm <= lim + 1e-9)[1][j];
    const smin = DADOS.FOLGA_MIN_TABELA.find(([lim]) => d_mm <= lim + 1e-9)[1][j];
    if (smax <= 0) throw new ErroEntrada([`A tabela não define folga para ψ = ${fmt_auto(psi_permil)} ‰ com D = ${fmt_auto(d_mm)} mm.`]);
    return [smin, smax];
  }
  /** [ISO VG, índice de pressão 1–3, índice de velocidade 0–4] */
  function vg_tabela(p_mpa, v) {
    const ip = p_mpa <= VG_LIMITES_PRESSAO[0] ? 1 : p_mpa <= VG_LIMITES_PRESSAO[1] ? 2 : 3;
    let iv = VG_LIMITES_VELOCIDADE.findIndex(lim => v <= lim);
    if (iv < 0) iv = VG_LIMITES_VELOCIDADE.length;
    return [DADOS.VG_TABELA[ip][iv], ip, iv];
  }
  /** f/ψ = π/(So·√(1−ε²)) + (ε/2)·sen β */
  function atrito_relativo(so, eps, beta_graus) {
    return Math.PI / (so * Math.sqrt(1 - eps * eps)) + eps / 2 * Math.sin(beta_graus * Math.PI / 180);
  }
  /** So → ε, β → f, Pf, h mín para uma folga relativa e uma viscosidade. */
  function calculo_hidrodinamico(rotulo, f_n, d_mm, l_mm, n_rpm, psi, eta) {
    const d = d_mm / 1000.0, l = l_mm / 1000.0;
    const omega = 2 * Math.PI * n_rpm / 60.0;
    const p_med = f_n / (d * l);
    const so = p_med * psi ** 2 / (eta * omega);
    const [eps, limitado] = eps_de_sommerfeld(so, l / d);
    const beta = beta_de_eps(eps, l / d);
    const f = psi * atrito_relativo(so, eps, beta);
    const pf = f * f_n * omega * d / 2.0;
    const hmin = d / 2.0 * psi * (1 - eps);
    return { rotulo, psi, eta, so, eps, beta, f, pf, hmin, limitado,
      regime: so > 1 ? 'carga elevada (So > 1)' : 'alta velocidade (So < 1)' };
  }
  /** Temperatura em que Pf(T) = α·A·(T − T amb) — regula falsi (Illinois). [T, convergiu] */
  function temperatura_por_balanco(f_n, d, l, n, psi, vg, area, alfa, t_amb) {
    const g = t => calculo_hidrodinamico('', f_n, d, l, n, psi, viscosidade_oleo(vg, t)[0]).pf - alfa * area * (t - t_amb);
    let a = t_amb + 0.01, b = 250.0, ga = g(a), gb = g(b);
    if (gb > 0) return [b, false];
    if (ga <= 0) return [a, true];
    let lado = 0, c = 0.5 * (a + b);
    for (let i = 0; i < 100; i++) {
      c = (a * gb - b * ga) / (gb - ga);
      const gc = g(c);
      if (gc > 0) { a = c; ga = gc; if (lado === 1) gb *= 0.5; lado = 1; }
      else { b = c; gb = gc; if (lado === -1) ga *= 0.5; lado = -1; }
      if (b - a < 1e-7 || Math.abs(gc) < 1e-7) break;
    }
    return [c, true];
  }

  /** Cálculo completo do mancal (planilha de mancais com as correções M1–M8). */
  function calcular_mancal(e, n_rpm, d_ponta = null) {
    const erros = [], avisos = [], notas = [];
    let d, d_origem;
    if (e.mancal_diametro) { d = Number(e.mancal_diametro); d_origem = 'informado'; }
    else {
      const base = d_ponta || 0;
      const x = DADOS.MANCAL_DIAMETROS.find(v => v >= base - 1e-9);
      if (x === undefined) throw new ErroEntrada([`Mancal: ponta de eixo de ${fmt_auto(base)} mm acima da lista de diâmetros de mancal (máx. 1.250 mm) — informe o diâmetro do colo.`]);
      d = x; d_origem = `automático — menor diâmetro da lista de mancais ≥ ponta de eixo (${fmt_auto(base)} mm)`;
    }
    if (!(MANCAL_D_MIN < d && d <= MANCAL_D_MAX))
      erros.push(`Mancal: diâmetro do colo deve estar entre ${fmt_int(MANCAL_D_MIN)} e ${fmt_int(MANCAL_D_MAX)} mm (faixa das tabelas de folga).`);
    let l, l_origem;
    if (e.mancal_largura) { l = Number(e.mancal_largura); l_origem = 'informada'; }
    else {
      const bd_in = e.mancal_bd ? e.mancal_bd : MANCAL_BD_PADRAO;
      l = arredondar(bd_in * d, 1); l_origem = `B/D = ${fmt_auto(bd_in)} × D`;
    }
    const bd = d ? l / d : 0;
    if (!(MANCAL_BD[0] - 1e-9 <= bd && bd <= MANCAL_BD[MANCAL_BD.length - 1] + 1e-9))
      erros.push(`Mancal: B/D = ${fmt(bd, 3)} fora da faixa calculada (0,125 a 1,5).`);
    let carga = 0, carga_origem = '';
    if (e.mancal_carga) { carga = Number(e.mancal_carga); carga_origem = 'informada'; }
    else if (e.mancal_massa_rotor) {
      const fracao = (e.mancal_fracao !== null && e.mancal_fracao !== undefined) ? e.mancal_fracao : 50.0;
      const fator = (e.mancal_fator_carga !== null && e.mancal_fator_carga !== undefined) ? e.mancal_fator_carga : 1.0;
      if (e.mancal_massa_rotor <= 0) erros.push('Mancal: a massa do rotor deve ser maior que zero.');
      if (!(0 < fracao && fracao <= 100)) erros.push('Mancal: a fração do peso do rotor no mancal deve estar entre 0 e 100%.');
      if (fator <= 0) erros.push('Mancal: o fator de carga deve ser maior que zero.');
      carga = e.mancal_massa_rotor * G_ACEL * fracao / 100.0 * fator;
      carga_origem = `massa do rotor ${fmt_auto(e.mancal_massa_rotor)} kg × 9,81 × ${fmt_auto(fracao)}%` + (Math.abs(fator - 1) > 1e-12 ? ` × fator ${fmt_auto(fator)}` : '');
    } else erros.push('Mancal: informe a carga radial (N) ou a massa do rotor (kg).');
    if (e.mancal_carga !== null && e.mancal_carga !== undefined && e.mancal_carga <= 0) erros.push('Mancal: a carga radial deve ser maior que zero.');
    const balanco = e.mancal_modo_temp === 'balanco';
    if (balanco) {
      if (!(e.mancal_alfa && e.mancal_alfa > 0)) erros.push('Mancal: o coeficiente α da caixa deve ser maior que zero.');
      if (e.mancal_temp_ambiente === null || e.mancal_temp_ambiente === undefined || !(-30 <= e.mancal_temp_ambiente && e.mancal_temp_ambiente <= 100))
        erros.push('Mancal: temperatura ambiente fora da faixa (−30 a 100 °C).');
    } else if (e.mancal_temp_efetiva === null || e.mancal_temp_efetiva === undefined || !(-30 <= e.mancal_temp_efetiva && e.mancal_temp_efetiva <= 200))
      erros.push('Mancal: temperatura efetiva fora da faixa (−30 a 200 °C).');
    if (!(e.mancal_p_lim && e.mancal_p_lim > 0)) erros.push('Mancal: a pressão admissível deve ser maior que zero.');
    if (!(e.mancal_t_lim && e.mancal_t_lim > 0)) erros.push('Mancal: a temperatura máxima deve ser maior que zero.');
    if (balanco && !(e.mancal_area_caixa && e.mancal_area_caixa > 0)) erros.push('Mancal: no balanço térmico, informe a área externa da caixa (m²).');
    if (e.mancal_vg !== null && e.mancal_vg !== undefined && !(e.mancal_vg in OLEOS))
      erros.push(`Mancal: ISO VG ${e.mancal_vg} não cadastrado (${LISTA_OLEOS.join(', ')}).`);
    if (e.mancal_psi !== null && e.mancal_psi !== undefined && !PSI_SERIE.some(s => Math.abs(e.mancal_psi - s) < 1e-9))
      erros.push('Mancal: ψ deve ser um valor da série ' + PSI_SERIE.map(x => fmt_auto(x)).join(', ') + ' ‰.');
    if (!e.mancal_volume_oleo || e.mancal_volume_oleo <= 0) erros.push('Mancal: o volume de óleo deve ser maior que zero.');
    if (erros.length) throw new ErroEntrada(erros);

    const omega = 2 * Math.PI * n_rpm / 60.0;
    const v = velocidade_periferica(d, n_rpm);
    const p = carga / (d * l);
    const [h_lim, fd, fv] = h_lim_tabela(d, v);
    let psi_m, psi_origem, psi_fatores = null;
    if (e.mancal_psi) { psi_m = Number(e.mancal_psi); psi_origem = 'informada'; }
    else {
      const [pm, fdm, fm] = psi_tabela(d, v);
      if (pm === null) throw new ErroEntrada([`Mancal: v = ${fmt(v, 1)} m/s > 50 m/s — fora da tabela de folga relativa; informe ψ.`]);
      psi_m = pm; psi_origem = 'tabela D × v'; psi_fatores = [fdm, fm];
    }
    const [folga_min, folga_max] = folgas_tabela(d, psi_m);
    const it7 = it7_furo(d);
    const furo_min = d, furo_max = d + it7;
    const eixo_max = furo_min - folga_min, eixo_min = furo_max - folga_max;
    const eixo_med = 0.5 * (eixo_min + eixo_max), eixo_tol = 0.5 * (eixo_max - eixo_min);
    const ajuste_viavel = eixo_min <= eixo_max + 1e-12;
    const psi_min = folga_min / d, psi_max = folga_max / d, psi_med = 0.5 * (psi_min + psi_max);
    let vg, vg_origem, vg_indices = null;
    if (e.mancal_vg) { vg = Math.round(Number(e.mancal_vg)); vg_origem = 'informado'; }
    else { const [x, ip, iv] = vg_tabela(p, v); vg = x; vg_origem = 'tabela pressão × velocidade'; vg_indices = [ip, iv]; }
    let t_eff, t_origem, convergiu = true;
    if (balanco) {
      [t_eff, convergiu] = temperatura_por_balanco(carga, d, l, n_rpm, psi_med, vg, e.mancal_area_caixa, e.mancal_alfa, e.mancal_temp_ambiente);
      t_origem = `balanço térmico: Pf = α·A·(T − T amb), α = ${fmt_auto(e.mancal_alfa)} W/m²K, A = ${fmt_auto(e.mancal_area_caixa)} m², T amb = ${fmt_auto(e.mancal_temp_ambiente)} °C`;
      if (!convergiu) avisos.push('Balanço térmico sem equilíbrio abaixo de 250 °C — a caixa não dissipa a perda por atrito.');
    } else {
      t_eff = Number(e.mancal_temp_efetiva);
      t_origem = 'informada' + (Math.abs(t_eff - 40) < 1e-9 ? ' — hipótese da planilha: viscosidade a 40 °C' : '');
    }
    const [eta, nu, rho] = viscosidade_oleo(vg, t_eff);
    const casos = {
      'folga mínima': calculo_hidrodinamico('folga mínima', carga, d, l, n_rpm, psi_min, eta),
      'folga média': calculo_hidrodinamico('folga média', carga, d, l, n_rpm, psi_med, eta),
      'folga máxima': calculo_hidrodinamico('folga máxima', carga, d, l, n_rpm, psi_max, eta)
    };
    const principal = casos['folga média'];
    const critico = Object.values(casos).reduce((a, b) => (b.hmin < a.hmin ? b : a));
    const q_ref = v * (d / 1000) * psi_max * (l / 1000);
    const volume = Number(e.mancal_volume_oleo);
    const massa = volume / 1000.0 * OLEOS[vg].rho15;
    const dt_1min = 60.0 * principal.pf / (massa * CP_OLEO);
    const rig_comp = carga / ((p * 1e6 / MODULO_OLEO) * (d / 1000) * psi_min);
    const folga_radial = principal.psi * d / 2000.0;
    const eFim = MANCAL_EPS[MANCAL_EPS.length - 1];
    const e1 = Math.max(principal.eps - 1e-4, 1e-4), e2 = Math.min(principal.eps + 1e-4, eFim);
    const dso = (sommerfeld_de_eps(e2, bd) - sommerfeld_de_eps(e1, bd)) / (e2 - e1);
    const rig_hidro = carga / principal.so * dso / folga_radial;

    // Comparação entre óleos (como a Planilha1) e entre rotações (colunas das tabelas)
    const por_oleo = OLEOS_COMPARACAO.concat(OLEOS_COMPARACAO.includes(vg) ? [] : [vg]).map(vg_k => {
      const t_k = balanco ? temperatura_por_balanco(carga, d, l, n_rpm, psi_med, vg_k, e.mancal_area_caixa, e.mancal_alfa, e.mancal_temp_ambiente)[0] : t_eff;
      const c = calculo_hidrodinamico(`VG ${vg_k}`, carga, d, l, n_rpm, psi_med, viscosidade_oleo(vg_k, t_k)[0]);
      const m_k = volume / 1000.0 * OLEOS[vg_k].rho15;
      return { vg: vg_k, t: t_k, caso: c, dt: 60 * c.pf / (m_k * CP_OLEO),
        atende: c.hmin * 1000 >= h_lim - 1e-12 && !c.limitado, selecionado: vg_k === vg };
    });
    const por_rotacao = COLUNAS_ROTACAO.map(([f_hz, polos]) => {
      const n_k = rotacao_sincrona(f_hz, polos);
      const v_k = velocidade_periferica(d, n_k);
      const hl_k = h_lim_tabela(d, v_k)[0];
      const psi_k = e.mancal_psi || psi_tabela(d, v_k)[0];
      const item = { f: f_hz, polos, n: n_k, v: v_k, h_lim: hl_k, psi_m: psi_k, vg_rec: vg_tabela(p, v_k)[0] };
      if (psi_k === null) { item.erro = 'v > 50 m/s'; return item; }
      const [smin_k, smax_k] = folgas_tabela(d, psi_k);
      const ps_k = 0.5 * (smin_k + smax_k) / d;
      const t_k = balanco ? temperatura_por_balanco(carga, d, l, n_k, ps_k, vg, e.mancal_area_caixa, e.mancal_alfa, e.mancal_temp_ambiente)[0] : t_eff;
      const c = calculo_hidrodinamico('', carga, d, l, n_k, ps_k, viscosidade_oleo(vg, t_k)[0]);
      Object.assign(item, { psi_eff: ps_k, t: t_k, caso: c, atende: c.hmin * 1000 >= hl_k - 1e-12 && !c.limitado,
        dt: 60 * c.pf / (massa * CP_OLEO) });
      return item;
    });

    // Verificações
    let status = 'ok';
    if (critico.hmin * 1000 < h_lim - 1e-12 || critico.limitado) {
      status = 'falha';
      avisos.push(`h mín = ${fmt(critico.hmin * 1e6, 1)} µm (${critico.rotulo}) < h lim = ${fmt(h_lim * 1000, 0)} µm: filme insuficiente — aumentar B/D, a viscosidade (VG) ou a folga, ou reduzir a carga.`);
    }
    if (critico.limitado) avisos.push('Sommerfeld exige ε > 0,99 — regime de atrito misto.');
    const p_falha = Math.max(e.mancal_p_lim, P_MAX_METAL_PATENTE);
    if (p > p_falha + 1e-12) {
      status = 'falha';
      avisos.push(`Pressão específica ${fmt(p, 2)} N/mm² acima do máximo de ${fmt_auto(p_falha)} N/mm² (DIN 31652-3, metal patente) — aumentar o diâmetro ou a largura da bucha.`);
    } else if (p > e.mancal_p_lim + 1e-12) {
      if (status === 'ok') status = 'atencao';
      avisos.push(`Pressão específica ${fmt(p, 2)} N/mm² acima do limite de referência ${fmt_auto(e.mancal_p_lim)} N/mm² (a DIN 31652-3 admite até 5 N/mm² para metal patente).`);
    }
    if (balanco && t_eff > e.mancal_t_lim) {
      status = 'falha';
      avisos.push(`Temperatura efetiva ${fmt(t_eff, 1)} °C acima do limite ${fmt_auto(e.mancal_t_lim)} °C.`);
    }
    if (!ajuste_viavel) {
      if (status === 'ok') status = 'atencao';
      avisos.push(`Ajuste não realizável com furo H7: a faixa de folga da tabela (${fmt(folga_max - folga_min, 3)} mm) é menor que a tolerância do furo (IT7 = ${fmt(it7, 3)} mm) — o colo ficaria com tolerância negativa. Use furo H6 (ou mais justo) ou outra folga ψm; o cálculo hidrodinâmico usa as folgas mínima e máxima da tabela.`);
    }
    if (principal.eps > 0.95 && !principal.limitado) {
      if (status === 'ok') status = 'atencao';
      avisos.push(`ε = ${fmt(principal.eps, 3)} > 0,95: mancal muito carregado, sensível a desalinhamento.`);
    }
    if (principal.so < 1)
      notas.push(`So = ${fmt(principal.so, 3)} < 1 (faixa de alta velocidade): mancal cilíndrico com carga leve — verificar estabilidade (oil whirl); se necessário, usar furo lemon-bore ou segmentos basculantes.`);
    if (d_ponta && d < d_ponta - 1e-9) notas.push(`Colo do mancal (${fmt_auto(d)} mm) menor que a ponta de eixo (${fmt_auto(d_ponta)} mm).`);
    if (Math.abs(t_eff - 40) < 1e-9 && !balanco)
      notas.push('Viscosidade a 40 °C (hipótese da planilha). Em regime o filme costuma operar a 50–70 °C, com viscosidade menor: h mín e perda por atrito reais serão menores — avalie também com a temperatura de operação ou o balanço térmico.');
    notas.push(`ε e β pela solução numérica da equação de Reynolds para B/D = ${fmt(bd, 3)}; So pela definição da DIN 31652 (com ω), corrigindo a planilha (ver M1).`);
    const status_texto = { ok: 'MANCAL ATENDE', atencao: 'MANCAL ATENDE COM RESSALVAS', falha: 'MANCAL NÃO ATENDE' }[status];

    return {
      d, d_origem, l, l_origem, bd, carga, carga_origem, n: n_rpm, omega, v, p, p_lim: e.mancal_p_lim, p_falha,
      h_lim, fd, fv, psi_m, psi_origem, psi_fatores, furo_min, furo_max, it7, eixo_min, eixo_max, eixo_med, eixo_tol,
      folga_min, folga_max, psi_min, psi_med, psi_max, vg, vg_origem, vg_indices, t_eff, t_origem, convergiu,
      eta, nu, rho, rho15: OLEOS[vg].rho15, nu100: OLEOS[vg].nu100, casos, principal, critico, q_ref,
      volume_oleo: volume, massa_oleo: massa, dt_1min, rigidez_compress: rig_comp, rigidez_hidro: rig_hidro,
      dso_deps: dso, folga_radial, por_oleo, por_rotacao, status, status_texto, avisos, notas,
      t_lim: e.mancal_t_lim, balanco, ajuste_viavel,
      alfa: e.mancal_alfa, area_caixa: e.mancal_area_caixa, t_amb: e.mancal_temp_ambiente
    };
  }

  /** Frase curta com o(s) critério(s) que definem a situação do mancal. */
  function situacao_mancal(m) {
    const k = m.critico;
    const ok_h = k.hmin * 1000 >= m.h_lim - 1e-12 && !k.limitado;
    const partes = [`h mín ${fmt(k.hmin * 1e6, 1)} µm ${ok_h ? '≥' : '<'} h lim ${fmt(m.h_lim * 1000, 0)} µm`];
    if (m.balanco && m.t_eff > m.t_lim) partes.push(`T ${fmt(m.t_eff, 1)} °C > T máx ${fmt_auto(m.t_lim)} °C`);
    if (m.p > m.p_lim + 1e-12) {
      const lim = Math.max(m.p_lim, P_MAX_METAL_PATENTE);
      partes.push(`p ${fmt(m.p, 2)} > ${fmt_auto(m.p > lim + 1e-12 ? lim : m.p_lim)} N/mm²`);
    }
    if (m.principal.eps > 0.95 && !m.principal.limitado) partes.push(`ε = ${fmt(m.principal.eps, 3)} > 0,95`);
    if (!m.ajuste_viavel) partes.push('ajuste H7 inviável');
    return partes.join('  ·  ');
  }

  // ════════════════════════════════════════════════════════════════════════
  // 5. Campo de pressão — equação de Reynolds (mesmo esquema do programa Python)
  // ════════════════════════════════════════════════════════════════════════
  /**
   * Resolve  ∂/∂θ(H³ ∂P/∂θ) + (D/B)² ∂/∂Z(H³ ∂P/∂Z) = 6 ∂H/∂θ,  H = 1 + ε·cos θ,  P = p·ψ²/(η·ω)
   * com P = 0 nas bordas, simetria no plano central (Z = 0) e P ≥ 0 (condição de Reynolds,
   * SOR projetado vermelho-preto). θ é medido a partir da folga máxima, no sentido de rotação.
   * Retorna { so, beta, P (Float64Array n×(m+1)), n, m, pMax, thetaPMax, thetaFim, iter }.
   */
  function resolver_reynolds(eps, bd, n = 144, m = 20, tol = 1e-8, itMax = 20000, omegaSor = 1.85) {
    const dth = 2 * Math.PI / n, dz = 1.0 / m, k = (1.0 / bd) ** 2;
    const ae = new Float64Array(n), aw = new Float64Array(n), an = new Float64Array(n), src = new Float64Array(n), ap = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const th = i * dth;
      const hh = 1 + eps * Math.cos(th), he = 1 + eps * Math.cos(th + dth / 2), hw = 1 + eps * Math.cos(th - dth / 2);
      ae[i] = he ** 3 / dth ** 2; aw[i] = hw ** 3 / dth ** 2; an[i] = k * hh ** 3 / dz ** 2;
      src[i] = -6 * (he - hw) / dth; ap[i] = ae[i] + aw[i] + 2 * an[i];
    }
    const W = m + 1;                       // colunas j = 0..m (j = m é a borda, P = 0)
    const P = new Float64Array(n * W);
    let iter = 0;
    for (; iter < itMax; iter++) {
      let dmax = 0, pmax = 0;
      for (let cor = 0; cor < 2; cor++) {
        for (let i = 0; i < n; i++) {
          const ie = i === n - 1 ? 0 : i + 1, iw = i === 0 ? n - 1 : i - 1;
          for (let j = (i + cor) & 1; j < m; j += 2) {
            const idx = i * W + j;
            const pn = P[idx + 1], ps = j === 0 ? P[idx + 1] : P[idx - 1];
            const gs = (ae[i] * P[ie * W + j] + aw[i] * P[iw * W + j] + an[i] * (pn + ps) + src[i]) / ap[i];
            const antigo = P[idx];
            let novo = antigo + omegaSor * (gs - antigo);
            if (novo < 0) novo = 0;
            P[idx] = novo;
            const dif = Math.abs(novo - antigo);
            if (dif > dmax) dmax = dif;
            if (novo > pmax) pmax = novo;
          }
        }
      }
      if (pmax > 0 && dmax / pmax < tol) break;
    }
    // Integração (trapézio em Z, simetria → ×2) e resultante
    let wx = 0, wy = 0, pMax = 0, iMax = 0;
    const perfil = new Float64Array(n);  // pressão no plano central (Z = 0)
    for (let i = 0; i < n; i++) {
      let integral = 0;
      for (let j = 0; j < m; j++) integral += 0.5 * (P[i * W + j] + P[i * W + j + 1]) * dz;
      integral *= 2;
      const th = i * dth;
      wx += integral * Math.cos(th); wy += integral * Math.sin(th);
      perfil[i] = P[i * W];
      if (P[i * W] > pMax) { pMax = P[i * W]; iMax = i; }
    }
    wx *= dth / 4; wy *= dth / 4;
    // extensão prática da zona de pressão (≥ 1 % do pico), a partir do pico
    const lim = 0.01 * pMax;
    let iFim = iMax;
    while (iFim < iMax + n && perfil[iFim % n] > lim) iFim++;
    let iIni = iMax;
    while (iIni > iMax - n && perfil[((iIni % n) + n) % n] > lim) iIni--;
    return { so: Math.hypot(wx, wy), beta: Math.atan2(Math.abs(wy), -wx) * 180 / Math.PI, P, perfil, n, m,
      pMax, thetaPMax: iMax * dth * 180 / Math.PI, thetaIni: ((iIni + 1) * dth * 180 / Math.PI), thetaFim: (iFim * dth * 180 / Math.PI), iter };
  }

  // ════════════════════════════════════════════════════════════════════════
  // 6. Exportação
  // ════════════════════════════════════════════════════════════════════════
  return {
    VERSAO, DADOS, K_TORQUE, FATOR_SEGURANCA_PADRAO, KW_POR_CV, KW_POR_HP, UNIDADES_POTENCIA, TIPOS_MAQUINA,
    MATERIAL_PERSONALIZADO, APLICACAO_OUTRA, SERIE_PADRAO, CRITERIO_PADRAO, MATERIAIS, ORDEM_MATERIAIS_DOC,
    APLICACOES, CRITERIOS, CRITERIO_CURTO, CATEGORIAS_MOTOR, COLUNAS_ROTACAO, ROTACOES_COLUNAS, DIAMETROS_SECAO8,
    SERIES_DIAMETROS, COMPRIMENTO_PONTA, POTENCIAS_SECAO9, ENTRADA_PADRAO,
    G_ACEL, MANCAL_D_MIN, MANCAL_D_MAX, MANCAL_BD_PADRAO, OLEOS, LISTA_OLEOS, OLEOS_COMPARACAO, PSI_SERIE, CP_OLEO,
    COEF_DILATACAO_OLEO, MODULO_OLEO, VOLUME_OLEO_PADRAO, P_LIM_PADRAO, P_MAX_METAL_PATENTE, T_LIM_PADRAO,
    T_EFETIVA_PADRAO, ALFA_CAIXA_PADRAO, T_AMBIENTE_PADRAO, VG_LIMITES_PRESSAO, VG_LIMITES_VELOCIDADE,
    MANCAL_BD, MANCAL_EPS,
    ErroEntrada, arredondar, fmt, fmt_int, fmt_auto, fmt_campo, fmt_sci, ler_numero, normalizar, ler_bool,
    achar_material, achar_aplicacao, achar_criterio,
    rotacao_sincrona, coluna_rotacao_rotulo, torque_nominal, tensao_referencia, diametro_minimo, torque_admissivel,
    potencia_maxima, tensao_torcao, selecionar_diametro, diametro_especial, tolerancia_iso, comprimento_ponta,
    carcacas_iec, menor_ponta_iec, secao_tabela8, secao_tabela9, errata_aplicavel, valor_tabela9_documento,
    tabela_potencia_maxima, tabela_diametro_minimo, serie_potencias,
    entrada, obter_material, potencia_calculo, rotacao_calculo, fator_servico, validar, calcular,
    sommerfeld_de_eps, beta_de_eps, eps_de_sommerfeld, densidade_oleo, viscosidade_oleo, velocidade_periferica,
    h_lim_tabela, psi_tabela, it7_furo, folgas_tabela, vg_tabela, atrito_relativo, calculo_hidrodinamico,
    temperatura_por_balanco, calcular_mancal, situacao_mancal, resolver_reynolds
  };
});
