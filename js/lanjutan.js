"use strict";
/* Pertanyaan lanjutan terstruktur untuk butir KPSP yang ditanyakan kepada orang tua/pengasuh (flag "n").
   Ini adaptasi CogniTrack, bukan bagian dari Buku Bagan: teks butir dan jawaban Ya/Tidak tetap utuh.
   Pertanyaan lanjutan muncul bila pengguna menjawab "Ya". Dokter menilai isi jawabannya, bukan kata "Ya".
   Aturan dicocokkan dengan teks butir (aturan pertama yang cocok dipakai), sehingga butir yang sama di
   beberapa formulir memakai pertanyaan lanjutan yang sama.
     words  : n baris kata + arti
     text   : isian bebas
     choice : satu pilihan; indeks di `bad` tidak konsisten dengan jawaban "Ya" */
const FOLLOWUP_RULES = [
  [/sedikitnya 3 kata yang bermakna/, { t: "words", n: 3, q: "Tuliskan 3 kata yang diucapkan anak dan artinya." }],
  [/minimal 7 kata yang mempunyai arti/, { t: "words", n: 7, q: "Tuliskan 7 kata yang diucapkan anak (selain “mama” dan “papa”) dan artinya." }],
  [/1 kata yang bermakna/, { t: "words", n: 1, q: "Tuliskan 1 kata yang diucapkan anak (selain “mama”, “papa”, atau nama panggilan) dan artinya." }],
  [/mengatakan ‘papa’/, { t: "text", q: "Tuliskan kata yang diucapkan anak dan kepada siapa.", ph: "misalnya: “papa” saat melihat ayahnya" }],
  [/2 suku kata yang sama/, { t: "text", q: "Tuliskan suara yang diucapkan bayi.", ph: "misalnya: ma-ma" }],
  [/menunjukkan apa yang diinginkannya/, { t: "choice", q: "Bagaimana anak biasanya menunjukkan keinginannya?", opts: ["Menunjuk", "Menarik tangan", "Bersuara atau berkata", "Menangis atau merengek"], bad: [3] }],
  [/meniru bila ibu atau pengasuh sedang melakukan pekerjaan rumah/, { t: "text", q: "Pekerjaan apa yang ditiru anak?", ph: "misalnya: menyapu dengan sapu kecil" }],
  [/menggabungkan 2 kata/, { t: "text", q: "Tuliskan contoh 2 kata berbeda yang digabung anak saat berbicara.", ph: "misalnya: minum susu" }],
  [/kalimat sederhana yang terdiri dari minimal 3 kata/, { t: "text", q: "Tuliskan contoh kalimat yang diucapkan anak.", ph: "misalnya: aku makan roti" }],
  [/perintah yang terdiri dari 2 langkah/, { t: "text", q: "Tuliskan contoh perintah 2 langkah yang dilakukan anak.", ph: "misalnya: ambil sepatu lalu taruh di rak" }],
  [/dipahami oleh orang asing|dipahami seluruhnya oleh orang/, { t: "text", q: "Siapa orang yang tidak bertemu anak setiap hari yang dapat memahami bicaranya?", ph: "misalnya: tetangga, guru PAUD" }],
  [/berbalik paling sedikit 2 kali/, { t: "choice", q: "Bagaimana bayi berbalik?", opts: ["Sendiri, dari terlentang ke tengkurap", "Sendiri, dari tengkurap ke terlentang", "Hanya bila dibantu"], bad: [2] }],
  [/suara gembira bernada tinggi/, { t: "text", q: "Dalam situasi apa bayi memekik gembira?", ph: "misalnya: saat diajak bercanda" }],
  [/tersenyum ketika melihat mainan/, { t: "text", q: "Apa yang membuat bayi tersenyum saat ia bermain sendiri?", ph: "misalnya: boneka, kucing peliharaan" }],
  [/menengok ke belakang/, { t: "choice", q: "Suara apa yang membuat bayi menengok?", opts: ["Bisikan atau suara pelan", "Langkah kaki yang pelan", "Hanya suara keras"], bad: [2] }],
  [/makan kue kering sendiri/, { t: "choice", q: "Bagaimana bayi makan kue kering?", opts: ["Memegang dan memakannya sendiri", "Harus disuapi"], bad: [1] }],
  [/memindahkan mainan atau kue/, { t: "choice", q: "Benda apa yang dipindahkan bayi dari satu tangan ke tangan lain?", opts: ["Mainan kecil atau kue kering", "Hanya sendok atau kerincingan bertangkai"], bad: [1] }],
  [/mengangkat badannya ke posisi berdiri/, { t: "choice", q: "Bagaimana anak berdiri?", opts: ["Berpegangan pada perabot lalu berdiri sendiri", "Berdiri tanpa berpegangan", "Harus ditarik atau dibantu orang"], bad: [2] }],
  [/duduk sendiri tanpa bantuan dari posisi tidur/, { t: "choice", q: "Bagaimana anak duduk dari posisi tidur atau tengkurap?", opts: ["Bangun dan duduk sendiri", "Harus dibantu didudukkan"], bad: [1] }],
  [/makna kata ’jangan’/, { t: "text", q: "Apa yang dilakukan anak saat Anda berkata “jangan”?", ph: "misalnya: berhenti dan menoleh" }],
  [/bersembunyi di belakang sesuatu/, { t: "text", q: "Ceritakan reaksi anak saat Anda bersembunyi lalu muncul kembali.", ph: "misalnya: menunggu sambil melihat ke arah Anda" }],
  [/membedakan ibu atau pengasuh dengan orang/, { t: "choice", q: "Bagaimana sikap anak saat pertama bertemu orang yang belum dikenal?", opts: ["Malu-malu atau ragu-ragu", "Menangis atau menempel pada ibu/pengasuh", "Sama saja seperti kepada orang yang dikenal"], bad: [2] }],
  [/berjalan dengan berpegangan/, { t: "choice", q: "Anak berjalan dengan berpegangan pada apa?", opts: ["Perabot (kursi, meja, dinding)", "Tangan orang dewasa", "Belum berjalan sama sekali"], bad: [2] }],
  [/bertepuk tangan atau melambai/, { t: "choice", q: "Bagaimana anak bertepuk tangan atau melambai?", opts: ["Sendiri tanpa dibantu", "Harus dipegangi tangannya"], bad: [1] }],
  [/minum dari cangkir atau gelas/, { t: "choice", q: "Bagaimana anak minum dari cangkir atau gelas?", opts: ["Memegang sendiri, sedikit tumpah", "Memegang sendiri, banyak tumpah", "Gelas dipegangi orang lain"], bad: [1, 2] }],
  [/berlari tanpa terjatuh/, { t: "choice", q: "Bagaimana anak berlari?", opts: ["Lancar tanpa terjatuh", "Sering terjatuh", "Belum bisa berlari"], bad: [1, 2] }],
  [/melepas pakaiannya/, { t: "text", q: "Pakaian apa yang dapat dilepas anak sendiri?", ph: "misalnya: celana, kaos" }],
  [/makan dengan menggunakan sendok/, { t: "choice", q: "Bagaimana anak makan dengan sendok?", opts: ["Sendiri, sedikit tumpah", "Sendiri, banyak tumpah", "Disuapi"], bad: [1, 2] }],
  [/naik tangga sendiri/, { t: "choice", q: "Bagaimana anak naik tangga?", opts: ["Tegak tanpa berpegangan", "Berpegangan pada dinding atau pegangan tangga", "Merangkak", "Berpegangan pada orang lain", "Tidak diperbolehkan naik tangga"], bad: [2, 3, 4] }],
  [/berpakaian sendiri seperti baju, rok, celana/, { t: "text", q: "Pakaian apa yang dapat dipakai anak sendiri? (topi dan kaos kaki tidak dinilai)", ph: "misalnya: celana pendek, kaos" }],
  [/bermain peran/, { t: "text", q: "Ceritakan permainan peran yang dilakukan anak.", ph: "misalnya: menyuapi boneka lalu menidurkannya" }],
  [/menggosok gigi dengan bantuan/, { t: "choice", q: "Bagaimana anak menggosok gigi?", opts: ["Ikut memegang sikat dan menggosok, dengan bantuan", "Seluruhnya digosokkan orang lain"], bad: [1] }],
  [/mengenakan baju, celana, atau sepatu sendiri/, { t: "text", q: "Apa yang dapat dikenakan anak sendiri?", ph: "misalnya: celana dan sepatu tanpa tali" }],
  [/mencuci tangannya sendiri/, { t: "choice", q: "Bagaimana anak mencuci tangan setelah makan?", opts: ["Sendiri dengan baik", "Perlu dibantu"], bad: [1] }],
  [/menyebut nama teman bermain/, { t: "text", q: "Tuliskan nama teman atau saudara yang disebut anak.", ph: "misalnya: Dika, teman di PAUD" }],
  [/mengenakan kaos \(T-shirt\)/, { t: "choice", q: "Bagaimana anak mengenakan kaos?", opts: ["Sendiri tanpa dibantu", "Perlu dibantu"], bad: [1] }],
  [/mengikuti peraturan permainan/, { t: "text", q: "Permainan apa yang dimainkan anak sesuai aturannya?", ph: "misalnya: ular tangga, petak umpet" }],
  [/menggosok gigi(nya)? tanpa (dibantu|bantuan)/, { t: "choice", q: "Bagaimana anak menggosok gigi?", opts: ["Sendiri tanpa dibantu", "Perlu dibantu"], bad: [1] }],
  [/mengancingkan bajunya/, { t: "text", q: "Apa yang dapat dikancingkan anak?", ph: "misalnya: kemeja sekolah, baju boneka" }],
  [/tenang dan tidak rewel/, { t: "choice", q: "Bagaimana reaksi anak saat ditinggal?", opts: ["Tenang, tidak rewel", "Menangis atau menggelayut"], bad: [1] }],
  [/sepenuhnya berpakaian sendiri/, { t: "choice", q: "Bagaimana anak berpakaian?", opts: ["Sepenuhnya sendiri", "Masih perlu dibantu sebagian"], bad: [1] }],
  [/menyiapkan dan mengambil makanan/, { t: "text", q: "Ceritakan makanan atau minuman yang dapat disiapkan anak sendiri.", ph: "misalnya: menuang sereal dan susu ke mangkok" }]
];
const FOLLOWUP_DEFAULT = { t: "text", q: "Ceritakan contoh nyata ketika anak melakukannya.", ph: "kapan dan bagaimana" };
