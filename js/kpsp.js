"use strict";
/* Formulir KPSP per kelompok umur (bulan).
   Butir: [domain, teks butir, indeks aktivitas stimulasi terkait, flag, alat dan bahan]
     domain : GK gerak kasar · GH gerak halus · BB bicara-bahasa · SK sosialisasi-kemandirian
     indeks : posisi aktivitas pada STIMULASI[..][domain] (tabel pemetaan butir ke aktivitas)
     flag   : "k" = terkait aspek kognitif (ditandai untuk telaah ahli)
              "n" = kebiasaan sehari-hari, tidak direkam; dokter menelaah dari jawaban pengguna

   PENTING: teks butir di bawah masih DRAF prototype. Sebelum uji ahli, seluruh teks dan
   urutannya wajib diganti persis dengan Buku Bagan SDIDTK (Kemenkes RI, 2022). Adaptasi
   CogniTrack hanya boleh ada pada petunjuk pengamatan (lihat GUIDE di app.js). */
const KPSP_DRAFT = true;

const KPSP = {
  3: [
    ["GK", "Saat bayi telentang, apakah masing-masing lengan dan tungkainya bergerak dengan mudah? Jawab Tidak bila salah satu atau keduanya bergerak tidak terarah atau tidak terkendali.", 1, "", ""],
    ["SK", "Saat bayi telentang, apakah ia melihat dan menatap wajah Anda?", 0, "", ""],
    ["BB", "Apakah bayi dapat mengeluarkan suara-suara lain (mengoceh) selain menangis?", 0, "", ""],
    ["GH", "Saat bayi telentang, apakah ia dapat mengikuti gerakan Anda dengan menggerakkan kepalanya dari samping ke tengah?", 0, "k", "Mainan berwarna atau benang wol merah"],
    ["GH", "Saat bayi telentang, apakah ia dapat mengikuti gerakan Anda dengan menggerakkan kepalanya dari satu sisi hampir sampai ke sisi yang lain?", 0, "k", "Mainan berwarna atau benang wol merah"],
    ["SK", "Saat Anda mengajak bayi berbicara dan tersenyum, apakah ia tersenyum kembali?", 0, "", ""],
    ["GK", "Saat bayi tengkurap di alas yang datar, apakah ia dapat mengangkat kepalanya?", 0, "", "Alas datar"],
    ["GK", "Saat bayi tengkurap di alas yang datar, apakah ia dapat mengangkat kepalanya hingga membentuk sudut 45°?", 0, "", "Alas datar"],
    ["GK", "Saat bayi tengkurap di alas yang datar, apakah ia dapat mengangkat kepalanya dengan tegak?", 0, "", "Alas datar"],
    ["BB", "Apakah bayi suka tertawa keras walaupun tidak digelitik atau diraba-raba?", 1, "", ""]
  ],
  6: [
    ["GH", "Saat bayi telentang, apakah ia dapat mengikuti gerakan Anda dengan menggerakkan kepalanya sepenuhnya dari satu sisi ke sisi yang lain?", 0, "k", "Benang wol merah atau mainan berwarna"],
    ["GK", "Saat bayi telentang, pegang kedua tangannya lalu tarik perlahan ke posisi duduk. Dapatkah bayi mempertahankan lehernya tetap kaku? Jawab Tidak bila kepalanya jatuh ke belakang.", 0, "", ""],
    ["GH", "Pernahkah Anda melihat bayi memasukkan benda-benda ke mulutnya?", 0, "", ""],
    ["BB", "Pernahkah Anda mendengar bayi tertawa keras walaupun tidak digelitik atau diraba-raba?", 0, "", ""],
    ["GK", "Pernahkah bayi berbalik paling sedikit dua kali, dari telentang ke tengkurap atau sebaliknya?", 1, "n", ""],
    ["GH", "Pegang mainan di atas bayi yang telentang, dalam jangkauannya. Apakah bayi berusaha meraih mainan tersebut?", 0, "k", "Mainan kecil berwarna"],
    ["GK", "Saat bayi tengkurap di alas datar, apakah ia dapat mengangkat dadanya dengan kedua lengan sebagai penyangga?", 0, "", "Alas datar"],
    ["GH", "Apakah bayi dapat mengarahkan matanya pada benda kecil sebesar kacang atau kismis?", 1, "k", "Benda kecil sebesar kacang (awasi agar tidak tertelan)"],
    ["BB", "Apakah bayi dapat mengeluarkan suara gembira bernada tinggi atau memekik, tetapi bukan menangis?", 0, "", ""],
    ["SK", "Apakah bayi berusaha memperoleh mainan yang berada di luar jangkauannya?", 1, "k", "Mainan kesukaan"]
  ],
  9: [
    ["GK", "Saat bayi telentang, pegang kedua tangannya lalu tarik perlahan ke posisi duduk. Dapatkah bayi mempertahankan lehernya tetap kaku?", 0, "", ""],
    ["SK", "Pernahkah bayi makan kue atau biskuit sendiri?", 0, "n", "Biskuit bayi"],
    ["GH", "Saat bermain, apakah bayi dapat memindahkan mainan dari satu tangan ke tangan yang lain?", 0, "", "Mainan kecil atau kerincingan"],
    ["BB", "Apakah bayi menoleh ke arah suara saat namanya dipanggil?", 1, "", ""],
    ["GK", "Jika didudukkan, apakah bayi dapat duduk sendiri tanpa bersandar selama 60 detik?", 0, "", ""],
    ["GH", "Letakkan benda kecil (misalnya potongan biskuit) di atas meja. Dapatkah bayi memungutnya dengan gerakan meraup?", 1, "", "Potongan biskuit kecil"],
    ["GK", "Jika Anda mengangkat bayi melalui ketiaknya ke posisi berdiri, dapatkah ia menyangga sebagian berat badannya dengan kedua kaki?", 1, "", ""],
    ["SK", "Apakah bayi berusaha mengambil mainan yang berada di luar jangkauannya?", 1, "k", "Mainan kesukaan"],
    ["BB", "Apakah bayi dapat mengucapkan suku kata berulang seperti “ma-ma”, “da-da”, atau “ba-ba” walau belum berarti?", 0, "", ""],
    ["GH", "Letakkan dua balok kecil di meja. Dapatkah bayi mengambil keduanya, satu di masing-masing tangan, pada waktu bersamaan?", 0, "k", "Dua balok kecil atau kubus"]
  ],
  12: [
    ["SK", "Jika Anda bersembunyi lalu muncul kembali berulang kali di hadapan anak, apakah ia mencari Anda atau menunggu Anda muncul?", 1, "k", ""],
    ["GH", "Letakkan pensil di telapak tangan anak, lalu coba ambil perlahan. Sulitkah Anda mengambil pensil itu kembali?", 0, "", "Pensil"],
    ["GK", "Apakah anak dapat berdiri selama 30 detik atau lebih dengan berpegangan pada kursi atau meja?", 0, "", ""],
    ["BB", "Apakah anak dapat mengucapkan dua suku kata yang sama, misalnya “ma-ma”, “da-da”, atau “pa-pa”?", 0, "", ""],
    ["GK", "Apakah anak dapat mengangkat badannya ke posisi berdiri tanpa bantuan?", 0, "", ""],
    ["SK", "Apakah anak dapat membedakan Anda dengan orang yang belum ia kenal, misalnya tampak malu atau ragu terhadap orang asing?", 1, "n", ""],
    ["GH", "Apakah anak dapat mengambil benda kecil seperti kacang atau kismis dengan ibu jari dan jari lain?", 0, "", "Benda kecil yang aman (awasi agar tidak tertelan)"],
    ["GK", "Apakah anak dapat duduk sendiri tanpa bantuan dan tanpa bersandar?", 1, "", ""],
    ["SK", "Tanpa dibantu, apakah anak dapat bertepuk tangan atau melambaikan tangan?", 1, "", ""],
    ["GH", "Dapatkah anak memegang dua balok kecil dan membenturkannya satu sama lain?", 1, "", "Dua balok kecil atau kubus"]
  ],
  15: [
    ["SK", "Tanpa dibantu, apakah anak dapat bertepuk tangan atau melambaikan tangan?", 1, "", ""],
    ["BB", "Apakah anak dapat mengatakan “papa” saat memanggil atau melihat ayahnya, atau “mama” saat memanggil atau melihat ibunya?", 0, "", ""],
    ["GK", "Apakah anak dapat berdiri sendiri tanpa berpegangan selama sekitar 5 detik?", 0, "", ""],
    ["GK", "Apakah anak dapat berdiri sendiri tanpa berpegangan selama 30 detik atau lebih?", 0, "", ""],
    ["GK", "Tanpa berpegangan atau menyentuh lantai, apakah anak dapat membungkuk memungut mainan di lantai lalu berdiri kembali?", 1, "", "Mainan"],
    ["SK", "Apakah anak dapat menunjukkan apa yang diinginkannya tanpa menangis atau merengek, misalnya dengan menunjuk atau menarik tangan Anda?", 1, "n", ""],
    ["GK", "Apakah anak dapat berjalan di sepanjang ruangan tanpa jatuh atau terhuyung-huyung?", 0, "", ""],
    ["GH", "Apakah anak dapat mengambil benda kecil seperti kacang atau potongan biskuit dengan ibu jari dan jari telunjuk?", 0, "", "Potongan biskuit kecil"],
    ["GH", "Jika Anda menggelindingkan bola ke arah anak, apakah ia menggelindingkan atau melemparkannya kembali kepada Anda?", 1, "k", "Bola"],
    ["SK", "Apakah anak dapat memegang cangkir atau gelas sendiri dan minum tanpa banyak tumpah?", 0, "", "Gelas plastik berisi sedikit air"]
  ],
  18: [
    ["SK", "Tanpa dibantu, apakah anak dapat bertepuk tangan atau melambaikan tangan?", 0, "", ""],
    ["BB", "Apakah anak dapat mengucapkan paling sedikit 3 kata yang mempunyai arti selain “papa” dan “mama”?", 1, "", ""],
    ["GH", "Apakah anak dapat menumpuk 2 balok kecil?", 1, "", "Balok kecil atau kubus"],
    ["SK", "Apakah anak dapat menunjukkan apa yang diinginkannya tanpa menangis atau merengek?", 0, "n", ""],
    ["GK", "Apakah anak dapat berjalan di sepanjang ruangan tanpa jatuh atau terhuyung-huyung?", 0, "", ""],
    ["GK", "Tanpa berpegangan atau menyentuh lantai, apakah anak dapat membungkuk memungut mainan lalu berdiri kembali?", 1, "", "Mainan"],
    ["GH", "Beri anak pensil dan kertas. Apakah anak dapat mencoret-coret kertas tanpa bantuan atau petunjuk?", 0, "", "Pensil atau krayon dan kertas"],
    ["GH", "Apakah anak dapat memasukkan balok kecil ke dalam cangkir atau wadah setelah dicontohkan?", 1, "k", "Balok kecil dan cangkir"],
    ["SK", "Apakah anak dapat memegang cangkir sendiri dan minum tanpa banyak tumpah?", 0, "", "Gelas plastik"],
    ["BB", "Apakah anak dapat menunjuk paling sedikit satu bagian tubuhnya saat diminta (misalnya mata atau hidung)?", 0, "k", ""]
  ],
  21: [
    ["GH", "Apakah anak dapat menumpuk 4 balok kecil tanpa menjatuhkannya?", 1, "", "Balok kecil atau kubus"],
    ["GH", "Beri anak pensil dan kertas. Apakah anak dapat mencoret-coret kertas tanpa bantuan?", 0, "", "Pensil atau krayon dan kertas"],
    ["BB", "Apakah anak dapat menunjuk dengan benar paling sedikit satu bagian tubuhnya (rambut, mata, hidung, mulut) saat diminta?", 0, "k", ""],
    ["SK", "Apakah anak dapat melepas pakaiannya sendiri, seperti baju, rok, atau celana? Topi dan kaus kaki tidak dinilai.", 1, "", ""],
    ["GK", "Apakah anak dapat naik tangga sendiri dengan cara apa saja, misalnya berjalan, merangkak, atau berpegangan?", 0, "", "Tangga (dampingi anak)"],
    ["SK", "Apakah anak dapat makan sendiri tanpa banyak tumpah?", 0, "n", ""],
    ["GK", "Apakah anak dapat menendang bola kecil ke depan tanpa berpegangan?", 1, "", "Bola sebesar bola tenis"],
    ["BB", "Apakah anak dapat mengucapkan paling sedikit 3 kata yang mempunyai arti selain “papa” dan “mama”?", 1, "", ""],
    ["SK", "Apakah anak dapat menunjukkan apa yang diinginkannya tanpa menangis atau merengek?", 0, "n", ""],
    ["GK", "Apakah anak dapat berjalan mundur 5 langkah atau lebih tanpa kehilangan keseimbangan?", 1, "", ""]
  ],
  24: [
    ["SK", "Saat Anda melakukan pekerjaan rumah tangga, apakah anak meniru apa yang Anda lakukan?", 1, "n", ""],
    ["GH", "Apakah anak dapat menumpuk 4 balok kecil tanpa menjatuhkannya?", 0, "", "Balok kecil atau kubus"],
    ["BB", "Apakah anak dapat mengucapkan paling sedikit 3 kata yang mempunyai arti selain “papa” dan “mama”?", 0, "", ""],
    ["GK", "Apakah anak dapat berjalan mundur 5 langkah atau lebih tanpa kehilangan keseimbangan?", 1, "", ""],
    ["SK", "Apakah anak dapat melepas pakaiannya sendiri, seperti baju, rok, atau celana?", 0, "", ""],
    ["GK", "Apakah anak dapat naik tangga sendiri dengan cara apa saja?", 1, "", "Tangga (dampingi anak)"],
    ["GH", "Beri anak pensil dan kertas. Apakah anak dapat mencoret-coret kertas tanpa bantuan?", 1, "", "Pensil atau krayon dan kertas"],
    ["BB", "Apakah anak dapat menunjuk dengan benar paling sedikit dua bagian tubuhnya saat diminta?", 1, "k", ""],
    ["SK", "Apakah anak dapat makan sendiri tanpa banyak tumpah?", 0, "n", ""],
    ["GK", "Apakah anak dapat menendang bola kecil ke depan tanpa berpegangan?", 1, "", "Bola sebesar bola tenis"]
  ],
  30: [
    ["SK", "Apakah anak dapat mencuci dan mengeringkan tangannya sendiri?", 0, "", "Air dan lap"],
    ["GK", "Apakah anak dapat melompat ke atas dengan kedua kaki bersamaan tanpa berpegangan?", 0, "", ""],
    ["GH", "Apakah anak dapat menumpuk 6 balok kecil tanpa menjatuhkannya?", 0, "", "Balok kecil atau kubus"],
    ["BB", "Tunjukkan gambar kucing, burung, kuda, anjing, dan orang. Dapatkah anak menunjuk dengan benar paling sedikit 2 gambar yang Anda sebut?", 1, "k", "Gambar hewan dan orang"],
    ["BB", "Dapatkah anak menggabungkan dua kata saat berbicara, misalnya “minta minum” atau “mau tidur”?", 0, "", ""],
    ["GH", "Buat garis lurus dari atas ke bawah di kertas. Dapatkah anak meniru membuat garis serupa?", 1, "", "Pensil dan kertas"],
    ["GK", "Dapatkah anak melempar bola lurus ke arah perut atau dada Anda dari jarak 1,5 meter?", 1, "", "Bola"],
    ["BB", "Dapatkah anak mengikuti perintah sederhana tanpa isyarat, misalnya “letakkan kertas di lantai”?", 0, "k", "Selembar kertas"],
    ["SK", "Dapatkah anak memakai sepatunya sendiri (tidak perlu mengikat tali)?", 0, "", ""],
    ["SK", "Saat Anda mengerjakan pekerjaan rumah, apakah anak ikut membantu atau meniru?", 1, "n", ""]
  ],
  36: [
    ["GH", "Dapatkah anak menumpuk 8 balok kecil tanpa menjatuhkannya?", 1, "", "Balok kecil atau kubus"],
    ["BB", "Dapatkah anak menyebut nama 4 dari gambar berikut tanpa dibantu: kucing, burung, kuda, anjing, orang?", 1, "k", "Gambar hewan dan orang"],
    ["GK", "Dapatkah anak berdiri dengan satu kaki tanpa berpegangan selama 2 detik atau lebih?", 0, "", ""],
    ["SK", "Dapatkah anak memakai celana, baju, atau kaus kaki tanpa dibantu?", 0, "", ""],
    ["GH", "Buat lingkaran di kertas. Dapatkah anak meniru menggambar lingkaran?", 0, "", "Pensil dan kertas"],
    ["BB", "Dapatkah anak mengerti arti “di atas”, “di bawah”, dan “di depan”? Minta ia meletakkan benda sesuai perintah.", 0, "k", "Balok kecil"],
    ["GK", "Dapatkah anak melompat ke depan dengan kedua kaki bersamaan?", 0, "", ""],
    ["SK", "Dapatkah anak bermain bersama anak lain, misalnya petak umpet atau kejar-kejaran, dengan mengikuti aturan sederhana?", 1, "n", ""],
    ["BB", "Dapatkah anak menyebutkan nama lengkapnya tanpa dibantu?", 0, "", ""],
    ["GK", "Dapatkah anak melempar bola lurus ke arah perut atau dada Anda dari jarak 1,5 meter?", 1, "", "Bola"]
  ],
  42: [
    ["SK", "Dapatkah anak memakai celana panjang, kemeja, baju, atau kaus kaki tanpa dibantu?", 0, "", ""],
    ["GH", "Buat lingkaran di kertas. Dapatkah anak meniru menggambar lingkaran?", 0, "", "Pensil dan kertas"],
    ["BB", "Dapatkah anak menyebutkan nama lengkapnya tanpa dibantu?", 0, "", ""],
    ["BB", "Letakkan balok berwarna merah, kuning, hijau, dan biru. Dapatkah anak menyebut paling sedikit satu warna dengan benar?", 1, "k", "Balok atau benda berwarna"],
    ["GK", "Dapatkah anak berdiri dengan satu kaki tanpa berpegangan selama 2 detik atau lebih?", 0, "", ""],
    ["GH", "Dapatkah anak menumpuk 8 balok kecil tanpa menjatuhkannya?", 1, "", "Balok kecil atau kubus"],
    ["SK", "Dapatkah anak bermain petak umpet, ular naga, atau permainan lain dengan mengikuti aturan?", 1, "n", ""],
    ["BB", "Dapatkah anak mengerti arti “di atas”, “di bawah”, “di depan”, dan “di belakang”?", 0, "k", "Balok kecil"],
    ["GK", "Dapatkah anak melompat ke depan dengan kedua kaki bersamaan sejauh lebar kertas?", 0, "", "Selembar kertas"],
    ["SK", "Dapatkah anak mencuci dan mengeringkan tangannya sendiri?", 0, "", ""]
  ],
  48: [
    ["GH", "Buat tanda tambah (+) di kertas. Dapatkah anak meniru menggambarnya?", 0, "", "Pensil dan kertas"],
    ["BB", "Letakkan balok berwarna merah, kuning, hijau, dan biru. Dapatkah anak menyebut nama paling sedikit 2 warna dengan benar?", 0, "k", "Balok atau benda berwarna"],
    ["GK", "Dapatkah anak mengayuh sepeda roda tiga sejauh sedikitnya 3 meter?", 1, "", "Sepeda roda tiga"],
    ["SK", "Dapatkah anak memakai baju atau kaus tanpa dibantu?", 0, "", ""],
    ["BB", "Tanyakan: “Apa yang kamu lakukan kalau kedinginan? Kalau lapar? Kalau lelah?” Dapatkah anak menjawab paling sedikit 2 dengan benar?", 0, "k", ""],
    ["GH", "Dapatkah anak meniru menggambar lingkaran?", 1, "", "Pensil dan kertas"],
    ["SK", "Dapatkah anak berpisah dengan Anda tanpa menangis, misalnya saat diantar ke PAUD?", 1, "n", ""],
    ["GK", "Dapatkah anak berdiri dengan satu kaki tanpa berpegangan selama 4 detik atau lebih?", 0, "", ""],
    ["BB", "Dapatkah anak mengerti arti “di atas”, “di bawah”, “di depan”, dan “di belakang”?", 0, "k", "Balok kecil"],
    ["GK", "Dapatkah anak melompat dengan satu kaki beberapa kali tanpa berpegangan?", 0, "", ""]
  ],
  54: [
    ["GH", "Minta anak menggambar orang. Apakah gambarnya memiliki paling sedikit 3 bagian tubuh?", 0, "k", "Pensil dan kertas"],
    ["BB", "Tanyakan kegunaan kursi, cangkir, dan pensil. Dapatkah anak menjawab paling sedikit 2 dengan benar?", 0, "k", ""],
    ["GK", "Dapatkah anak melompat dengan satu kaki beberapa kali tanpa berpegangan?", 0, "", ""],
    ["SK", "Dapatkah anak menggosok gigi tanpa dibantu?", 0, "", ""],
    ["BB", "Dapatkah anak menceritakan kembali kejadian yang baru dialaminya dengan kalimat yang dapat dipahami?", 1, "k", ""],
    ["SK", "Dapatkah anak berpakaian sendiri tanpa dibantu?", 0, "", ""],
    ["GH", "Buat tanda tambah (+) di kertas. Dapatkah anak meniru menggambarnya?", 1, "", "Pensil dan kertas"],
    ["GK", "Dapatkah anak berdiri dengan satu kaki tanpa berpegangan selama 6 detik atau lebih?", 0, "", ""],
    ["BB", "Letakkan balok berwarna merah, kuning, hijau, dan biru. Dapatkah anak menyebut keempat warna dengan benar?", 0, "k", "Balok atau benda berwarna"],
    ["SK", "Dapatkah anak berpisah dengan Anda tanpa menangis?", 1, "n", ""]
  ],
  60: [
    ["GH", "Buat segi empat di kertas. Dapatkah anak meniru menggambarnya?", 0, "", "Pensil dan kertas"],
    ["BB", "Letakkan 5 balok di meja. Dapatkah anak menghitung jumlahnya dengan benar sambil menunjuk satu per satu?", 1, "k", "5 balok kecil"],
    ["GK", "Dapatkah anak berdiri dengan satu kaki tanpa berpegangan selama 6 detik atau lebih?", 0, "", ""],
    ["SK", "Dapatkah anak berpakaian sendiri tanpa dibantu?", 0, "", ""],
    ["BB", "Tanyakan lawan kata: “Api panas, es…?”, “Ibu perempuan, ayah…?”, “Kuda besar, tikus…?”. Dapatkah anak menjawab paling sedikit 2 dengan benar?", 0, "k", ""],
    ["GK", "Dapatkah anak melompat dengan satu kaki sebanyak 3 kali atau lebih tanpa berpegangan?", 0, "", ""],
    ["GH", "Minta anak menggambar orang. Apakah gambarnya memiliki paling sedikit 6 bagian tubuh?", 1, "k", "Pensil dan kertas"],
    ["SK", "Dapatkah anak bermain permainan dengan aturan sederhana bersama teman dan menunggu giliran?", 1, "n", ""],
    ["BB", "Tanyakan kegunaan kursi, cangkir, dan pensil. Dapatkah anak menjawab ketiganya dengan benar?", 0, "k", ""],
    ["GK", "Dapatkah anak menangkap bola kecil dengan kedua tangan dari jarak 1 meter?", 1, "", "Bola kecil"]
  ],
  66: [
    ["GH", "Minta anak menggambar orang. Apakah gambarnya memiliki paling sedikit 6 bagian tubuh?", 1, "k", "Pensil dan kertas"],
    ["BB", "Tanyakan arti kata bola, sungai, meja, sepatu, dan pisang. Dapatkah anak menjelaskan arti paling sedikit 3 kata?", 0, "k", ""],
    ["GK", "Dapatkah anak berjalan lurus dengan tumit menyentuh ujung jari kaki (seperti meniti) sejauh 4 langkah atau lebih?", 0, "", ""],
    ["SK", "Dapatkah anak berpakaian sendiri termasuk mengancingkan baju?", 0, "", ""],
    ["GH", "Buat segi empat di kertas. Dapatkah anak meniru menggambarnya?", 0, "", "Pensil dan kertas"],
    ["BB", "Tanyakan lawan kata: “Api panas, es…?”, “Ibu perempuan, ayah…?”, “Kuda besar, tikus…?”. Dapatkah anak menjawab ketiganya dengan benar?", 0, "k", ""],
    ["GK", "Dapatkah anak melompat dengan satu kaki sebanyak 3 kali atau lebih tanpa berpegangan?", 0, "", ""],
    ["SK", "Dapatkah anak bermain permainan dengan aturan sederhana bersama teman dan menunggu giliran?", 1, "n", ""],
    ["BB", "Letakkan 5 balok di meja. Dapatkah anak menghitung jumlahnya dengan benar?", 1, "k", "5 balok kecil"],
    ["GK", "Dapatkah anak menangkap bola kecil dengan kedua tangan dari jarak 1 meter?", 1, "", "Bola kecil"]
  ],
  72: [
    ["GH", "Buat segitiga di kertas. Dapatkah anak meniru menggambarnya?", 0, "", "Pensil dan kertas"],
    ["GH", "Dapatkah anak menulis namanya sendiri atau beberapa huruf?", 1, "k", "Pensil dan kertas"],
    ["BB", "Tanyakan arti kata bola, sungai, meja, sepatu, pisang, gorden, pagar, dan atap. Dapatkah anak menjelaskan arti paling sedikit 5 kata?", 0, "k", ""],
    ["BB", "Dapatkah anak menyebut angka 1 sampai 10 secara berurutan?", 1, "k", ""],
    ["BB", "Dapatkah anak menceritakan urutan kegiatannya dari bangun tidur sampai berangkat ke PAUD?", 0, "k", ""],
    ["GK", "Dapatkah anak berdiri dengan satu kaki tanpa berpegangan selama 10 detik atau lebih?", 0, "", ""],
    ["GK", "Dapatkah anak berjalan lurus dengan tumit menyentuh ujung jari kaki sejauh 4 langkah atau lebih?", 0, "", ""],
    ["GK", "Dapatkah anak menangkap bola kecil dengan kedua tangan dari jarak 1 meter?", 1, "", "Bola kecil"],
    ["SK", "Dapatkah anak berpakaian sendiri termasuk mengancingkan baju?", 0, "", ""],
    ["SK", "Dapatkah anak mengikuti aturan permainan dan menunggu gilirannya?", 1, "n", ""]
  ]
};
const FORM_AGES = Object.keys(KPSP).map(Number).sort((a, b) => a - b);
