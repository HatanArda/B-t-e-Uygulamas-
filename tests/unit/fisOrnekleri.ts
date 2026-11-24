// Gerçekçi (uydurma) fiş OCR çıktıları. Gerçek fiş fotoğrafları tests/fixtures'ta tutulur ve depoya gönderilmez.

/** Migros — adetli ve kilolu kalemler, kart ile ödeme */
export const MIGROS_ADET_KILO = `
MİGROS TİCARET A.Ş.
GELİBOLU MİGROS
ÇANAKKALE CAD. NO:12 GELİBOLU
V.D. BÜYÜK MÜKELLEFLER 6220529513
TARİH : 18.11.2026        SAAT : 14:32
FİŞ NO : 0045
A.FIST JUMBO                %1     *299,90
SEK QUARK CILEK 140         %1      *67,90
2 AD X 87,90
SEK QUARK PROTEIN 16        %1     *175,80
1,130 KG X 139,95
MUZ ITHAL                   %1     *158,14
AVOKADO                     %1      *69,95
PLASTIK POSET               %20      *1,00
ARA TOPLAM                         *772,69
TOPKDV                               *8,12
TOPLAM                             *772,69
KREDİ KARTI                        *772,69
************1234
Z NO:0412  EKÜ NO:0001
`;

/** Migros — Money kart indirimi ve yüzde indirim (eksi tutarlı satırlar) */
export const MIGROS_INDIRIM = `
MİGROS TİCARET A.Ş.
TARİH: 19/11/2026  SAAT: 18:05
ULKER ONEO NANE ARO         %10     *75,95
MONEY KART İNDİRİMİ                -23,50
LINDT EXTRA CREAMY          %10    *374,95
KAJU FISTIGI                %1     *119,90
2 AD X 87,90
SEK QUARK PROTEIN 16        %1     *175,80
LIONESSE ET MAKASI          %20    *479,95
%40 İNDİRİM                       *-191,98
POSET                       %20      *1,00
ARA TOPLAM                       *1.227,55
TOPLAM İNDİRİM                    *215,48
TOPKDV                              *71,30
TOPLAM                           *1.012,07
KREDİ KARTI                      *1.012,07
KART NO: 4543 21** **** 1234
`;

/** Osmar Gıda — adet satırı üstte, nakit ödeme */
export const OSMAR_NAKIT = `
OSMAR GIDA SAN. VE TİC. LTD. ŞTİ.
GELİBOLU / ÇANAKKALE
21-11-2026 09:41
ÜNAL T.Y.ÇEÇİL PEYNİRİ      %1     *187,00
2 AD X 20,00
TEKLİ EKMEK                 %1      *40,00
VİKO 3L TOPRAKLI PRİZ       %20    *575,00
LEFLEF DEPOLU SÜNGER        %20    *116,00
TOPKDV                             *110,46
TOPLAM                             *918,00
NAKİT                              *918,00
PARA ÜSTÜ                            *0,00
`;

/** Akaryakıt — litre ile, POS slibinde başka bankanın adı (güvenilmemeli) */
export const AKARYAKIT = `
MEMOCAN PETROL ÜRÜNLERİ LTD. ŞTİ.
SHELL GELİBOLU İSTASYONU
TARİH:16.11.2026 SAAT:20:14
41,630 LT X 96,10
MOTORİN                     %20  *4.000,64
TOPKDV                             *666,77
TOPLAM                           *4.000,64
KREDİ KARTI                      *4.000,64
-------- POS --------
İŞ BANKASI
SATIŞ
KART NO: 5258 **** **** 4321
TUTAR: 4.000,64 TL
ONAY KODU: 123456
`;

/** Kafe — "ÖDENECEK KDV DAHİL TUTAR", X ile maskelenmiş kart */
export const KAFE = `
MY MOON CAFE
ÇANAKKALE
21.11.2026  13:22
YİYECEK                     %10    *330,00
ARA TOPLAM                         *330,00
TOPKDV                              *30,00
ÖDENECEK KDV DAHİL TUTAR           *330,00
KREDİ KARTI                        *330,00
XXXXXXXXXXXX9876
`;

/** D&R — ürün adı ayrı satırda, tutar ve indirim alt satırda */
export const DR_INDIRIM = `
D&R KÜLTÜR SANAT VE EĞLENCE A.Ş.
16.11.2026 16:48
RİSKE ÖVGÜ
%10                                *375,00
İNDİRİM                             -70,21
GELİRKEN EKMEK AL
%10                                *330,00
İNDİRİM                             -61,79
TOPLAM                             *573,00
KREDİ KARTI                        *573,00
**** **** **** 1234
`;

/** File Market — ad satırı + miktar/tutar satırı, kilolu, okunamayan bir kalem, OCR hataları */
export const FILE_OCR_HATALI = `
FİLE MARKET
19.11.2026 11:03
ACTISOFT Y.HAVLU 100LU
2 AD X 109,00               %10    *218,00
2,792 KG X 34,90
MANDALİNA                   %1      *97,44
KEREVİZ SAPI                %1      *99,9O
*~#                         %1      *12,50
TOPLAM                             *427,84
KREDİ KARTI                        *427,84
************5555
`;
