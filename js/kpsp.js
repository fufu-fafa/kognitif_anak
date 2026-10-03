"use strict";
/* Formulir KPSP per kelompok umur (bulan), sesuai Buku Bagan SDIDTK (Kemenkes RI, edisi revisi 2022),
   hlm. 27–79. Teks butir, urutan, dan domain disalin dari buku; jangan diubah.
   Butir: [domain, teks butir, indeks aktivitas stimulasi terkait, flag, alat dan bahan, gambar, keterangan gambar]
     domain : GK gerak kasar · GH gerak halus · BB bicara dan bahasa · SK sosialisasi dan kemandirian
     indeks : posisi aktivitas pada STIMULASI[..][domain] (tabel pemetaan butir ke aktivitas)
     flag   : "k" = terkait aspek kognitif (ditandai untuk telaah ahli)
              "n" = ditanyakan kepada orang tua/pengasuh, tidak direkam; dokter menelaah dari jawaban pengguna
     gambar : berkas di img/kpsp/, dipotong dari halaman buku yang sama
   Adaptasi CogniTrack hanya ada pada alat dan bahan serta petunjuk pengamatan (GUIDE di app.js). */
const KPSP_DRAFT = false;
const KPSP_SOURCE = "Buku Bagan SDIDTK (Kemenkes RI, edisi revisi 2022)";

const IMG_HEWAN = "Gambar dari buku: kucing, burung, kuda, anjing, orang";
const IMG_GARIS = "Atas: contoh jawaban ‘Ya’ · bawah: contoh jawaban ‘Tidak’";
const IMG_ORANG3 = "Dua gambar kiri: jawaban ‘Ya’ · dua gambar kanan: jawaban ‘Tidak’";
const IMG_WARNA = "Kotak warna dari buku";
const ORANG = (n, koma) => `Berikan anak pensil dan kertas lalu katakan kepada anak “Buatlah gambar orang” (anak laki-laki, anak perempuan, papa, mama, dll). Jangan memberi perintah lebih dari itu. Jangan bertanya atau mengingatkan anak bila ada bagian yang belum tergambar. Dalam memberi nilai, hitunglah berapa bagian tubuh yang tergambar. Untuk bagian tubuh yang berpasangan seperti mata, telinga, lengan${koma ? "," : ""} dan kaki, setiap pasang dinilai 1 bagian. Pastikan anak telah menyelesaikan gambar sebelum memberikan penilaian. Dapatkah anak menggambar orang dengan sedikitnya ${n} bagian tubuh?`;
const SATU_KAKI = d => `Minta anak untuk berdiri 1 kaki tanpa berpegangan. Jika perlu tunjukkan caranya dan beri anak kesempatan sebanyak 3 kali. Dapatkah ia mempertahankan keseimbangan dalam waktu ${d} detik atau lebih?`;
const GARIS = "Buat garis lurus ke bawah sepanjang sekurang-kurangnya 2,5 cm. Minta anak untuk menggambar garis lain di samping garis ini.\nJawab ‘Ya’ bila ia menggambar garis seperti ini: (lihat contoh atas)\nJawab ‘Tidak’ bila ia menggambar garis seperti ini: (lihat contoh bawah)";
const KEGIATAN = "Tunjukkan anak gambar di bawah ini dan tanyakan:\n“Mana yang dapat terbang?”\n“Mana yang dapat mengeong?”\n“Mana yang dapat bicara?”\n“Mana yang dapat menggonggong?”\n“Mana yang dapat meringkik?”\nApakah anak dapat menunjuk 2 kegiatan yang sesuai?";
const KATA_DEPAN = (n, p) => `Mengenal konsep ${n} kata depan\nMinta anak untuk mengikuti perintah di bawah, jangan memberi isyarat${p}\n“Ambil benda (misalnya kertas, balok) dan letakkan di atas meja”\n“Ambil benda (misalnya kertas, balok) dan letakkan di bawah meja”\n“Ambil benda (misalnya kertas, balok) dan letakkan di depan ibu”\n“Ambil benda (misalnya kertas, balok) dan letakkan di samping ibu”\n“Ambil benda (misalnya kertas, balok) dan letakkan di belakang ibu”\nDapatkah anak melakukan sedikitnya ${n} perintah (memahami ${n} kata depan)?`;
const ARTI_KATA = n => `Memahami/mengartikan ${n} kata\nPastikan anak mendengar pemeriksa lalu katakan “Saya akan mengucapkan 1 kata dan saya ingin kamu menyebutkan apa arti kata itu”. Setiap kata dapat diberikan sebanyak 3 kali bila perlu. Pemeriksa dapat mengatakan “Beritahu saya sesuatu tentang itu” tetapi jangan tanya apa kegunaannya. Tanyalah setiap kata dalam satu waktu.\n“Apakah bola itu?”, “Apakah sungai itu?”, “Apakah meja itu?”, “Apakah mobil/motor itu?”, “Apakah rumah itu?”, “Apakah pisang itu?”, “Apakah pintu itu?”, “Apakah atap itu?”\nAnak dikatakan dapat mengartikan jika anak mengartikan yang sesuai dalam istilah: 1) kegunaan, 2) bentuk, 3) terbuat dari apa, 4) kategori umum. Dapatkah anak mengartikan ${n} kata yang sesuai?`;
const KERTAS = "Letakkan selembar kertas seukuran buku ini di atas lantai. Apakah anak dapat melompati bagian lebar kertas dengan mengangkat kedua kakinya secara bersamaan tanpa didahului lari?";
const TEKS_PERINTAH = "“Ambil kertas”\n“Ambil pensil”\n“Tutup pintu”";

const KPSP = {
  3: [
    ["GK", "Pada saat bayi terlentang, apakah masing-masing lengan dan tungkai bergerak dengan mudah? Jawab ‘Tidak’ bila salah satu atau kedua tungkai atau lengan bayi bergerak tak terarah atau tak terkendali.", 1, "", ""],
    ["SK", "Jangan membuat suara apapun. Pada saat bayi terlentang apakah ia melihat dan menatap wajah Anda?", 0, "", ""],
    ["SK", "Pada saat Anda mengajak bayi berbicara dan tersenyum, apakah ia tersenyum kembali kepada Anda?", 0, "", ""],
    ["BB", "Apakah bayi dapat mengeluarkan suara-suara lain (mengoceh) selain menangis?", 0, "", ""],
    ["BB", "Apakah bayi suka tertawa keras walau tidak digelitik atau diraba-raba?", 1, "", ""],
    ["GH", "Ambil gulungan wool merah, lalu letakkan di atas wajah di depan mata bayi. Gerakkan wool dari samping kiri ke kanan kepala atau sebaliknya. Apakah ia dapat mengikuti gerakan Anda dengan menggerakkan kepalanya dari kanan atau kiri ke tengah?", 0, "k", "Gulungan wool merah", "3-6"],
    ["GH", "Ambil gulungan wool merah, lalu letakkan di atas wajah di depan mata bayi. Gerakkan wool dari samping kiri ke kanan kepala atau sebaliknya. Apakah ia dapat mengikuti gerakan Anda dengan menggerakkan kepalanya dari satu sisi hampir sampai pada sisi yang lain?", 0, "k", "Gulungan wool merah", "3-7"],
    ["GK", "Pada saat bayi tengkurap di alas yang datar, apakah ia dapat mengangkat kepalanya seperti pada gambar?", 0, "", "Alas yang datar", "3-8"],
    ["GK", "Pada saat bayi tengkurap di alas yang datar, apakah ia dapat mengangkat kepalanya sehingga membentuk sudut 45˚ seperti pada gambar?", 0, "", "Alas yang datar", "3-9"],
    ["GK", "Pada saat bayi tengkurap di alas yang datar, apakah ia dapat mengangkat kepalanya dengan tegak seperti pada gambar?", 0, "", "Alas yang datar", "3-10"]
  ],
  6: [
    ["GH", "Bayi diposisikan terlentang. Ambil gulungan wool merah, letakkan di atas wajah di depan mata bayi. Gerakkan wool dari samping kiri ke kanan kepala. Apakah ia dapat mengikuti gerakan Anda dengan menggerakkan kepala sepenuhnya dari satu ke sisi yang lain?", 0, "k", "Gulungan wool merah", "6-1"],
    ["GK", "Pada posisi bayi terlentang, pegang kedua tangannya lalu tarik perlahan ke posisi duduk. Dapatkah bayi mempertahankan lehernya secara kaku seperti pada gambar? Jawab ‘Tidak’ bila kepala bayi jatuh kembali seperti gambar.", 0, "", "", "6-2", "Kiri: jawab ‘Ya’ · kanan: jawab ‘Tidak’"],
    ["GK", "Ketika bayi tengkurap di alas yang datar, apakah ia dapat mengangkat dada dengan kedua lengannya sebagai penyangga seperti pada gambar?", 0, "", "Alas yang datar", "6-3"],
    ["GK", "Bayi dipangku orang tua atau pengasuh. Dapatkah bayi mempertahankan posisi kepala dalam keadaan tegak dan stabil? Jawab ‘Tidak’ bila kepala bayi cenderung jatuh ke kanan, kiri, atau ke dadanya.", 0, "", ""],
    ["GH", "Bayi dipangku orang tua atau pengasuh. Sentuhkan pensil di punggung tangan atau ujung jari bayi (jangan meletakkan di atas telapak tangan bayi). Apakah bayi dapat menggenggam pensil itu selama beberapa detik?", 0, "", "Pensil", "6-5"],
    ["GH", "Bayi dipangku orang tua atau pengasuh. Dapatkah bayi mengarahkan matanya pada benda kecil sebesar kacang, kismis atau uang logam? Jawab ‘Tidak’ jika ia tidak dapat mengarahkan matanya.", 1, "k", "Benda kecil sebesar kacang, kismis, atau uang logam (awasi agar tidak tertelan)"],
    ["GH", "Bayi dipangku orang tua atau pengasuh. Dapatkah bayi meraih mainan yang diletakkan agak jauh namun masih berada dalam jangkauan tangannya?", 0, "k", "Mainan"],
    ["GK", "Tanyakan kepada orang tua atau pengasuh, pernahkah bayi berbalik paling sedikit 2 kali, dari terlentang ke tengkurap atau sebaliknya?", 1, "n", ""],
    ["BB", "Tanyakan kepada orang tua atau pengasuh, pernahkah bayi mengeluarkan suara gembira bernada tinggi atau memekik tetapi bukan menangis?", 0, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, pernahkah orang tua atau pengasuh melihat bayi tersenyum ketika melihat mainan yang lucu, gambar, atau binatang peliharaan pada saat ia bermain sendiri?", 1, "n", ""]
  ],
  9: [
    ["GH", "Bayi dipangku orang tua atau pengasuh, Taruh kismis di atas meja. Dapatkah bayi memungut dengan tangannya benda−benda kecil seperti kismis, kacang-kacangan, potongan biskuit dengan gerakan miring atau menggerapai seperti gambar?", 1, "", "Kismis, kacang, atau potongan biskuit (awasi agar tidak tertelan)", "9-1"],
    ["GH", "Bayi dipangku orang tua atau pengasuh. Taruh 2 kubus di atas meja, buat agar bayi dapat memungut dan memegang kubus pada masing-masing tangannya. Dapatkah ia melakukannya?", 0, "", "2 kubus"],
    ["GH", "Bayi dipangku orang tua atau pengasuh. Tarik perhatian bayi dengan memperlihatkan gulungan wool merah, kemudian jatuhkan ke lantai. Apakah bayi mencoba mencari benda tersebut, misalnya mencari di bawah meja atau di belakang kursi?", 0, "k", "Gulungan wool merah"],
    ["SK", "Bayi dipangku orang tua atau pengasuh. Letakkan suatu mainan yang diinginkan bayi di luar jangkauannya, apakah ia mencoba mendapatkan mainan dengan mengulurkan lengan atau badannya?", 0, "k", "Mainan kesukaan"],
    ["BB", "Tanyakan kepada orang tua atau pengasuh, apakah bayi menengok ke belakang seperti mendengar kedatangan seseorang pada saat bayi sedang bermain sendiri dan seseorang diam-diam datang berdiri di belakangnya? Suara keras tidak ikut dihitung. Jawab ‘Ya’ hanya jika melihat reaksinya terhadap suara yang perlahan atau bisikan.", 1, "n", ""],
    ["BB", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat mengatakan 2 suku kata yang sama, misalnya: “Ma-ma”, “Da-da” atau “Pa-pa”? Jawab ‘Ya’ bila ia dapat mengeluarkan salah 1 suara tersebut.", 0, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, apakah bayi dapat makan kue kering sendiri?", 0, "n", ""],
    ["GH", "Tanyakan kepada orang tua atau pengasuh apakah pernah melihat bayi memindahkan mainan atau kue kering dari satu tangan ke tangan yang lain? Benda−benda panjang seperti sendok atau kerincingan bertangkai tidak ikut dinilai.", 0, "n", ""],
    ["GK", "Tanpa disangga oleh bantal, kursi atau dinding, dapatkah bayi duduk sendiri selama 60 detik?", 0, "", "", "9-9"],
    ["GK", "Jika Anda mengangkat bayi melalui ketiaknya ke posisi berdiri, dapatkah ia menyangga sebagian berat badan dengan kedua kakinya? Jawab ‘Ya’ bila ia mencoba berdiri dan sebagian berat badan tertumpu pada kedua kakinya.", 1, "", ""]
  ],
  12: [
    ["GH", "Bayi dipangku orang tua atau pengasuh. Letakkan pensil di telapak tangan anak. Coba ambil pensil tersebut dengan perlahan-lahan. Apakah anak menggenggam pensil dengan erat dan Anda merasa kesulitan mendapatkan pensil itu kembali?", 1, "", "Pensil"],
    ["GH", "Bayi dipangku orang tua atau pengasuh. Letakkan kismis di atas meja. Dapatkah anak memungut dengan tangannya benda−benda kecil seperti kismis, kacang−kacangan, potongan biskuit dengan gerakan miring atau menggerapai seperti gambar?", 0, "", "Kismis, kacang, atau potongan biskuit (awasi agar tidak tertelan)", "12-2"],
    ["GH", "Bayi dipangku orang tua atau pengasuh. Berikan 2 kubus kepada bayi. Tanpa bantuan, apakah anak dapat mempertemukan 2 kubus kecil yang ia pegang?", 1, "", "2 kubus kecil"],
    ["BB", "Sebut 2−3 kata yang dapat ditiru oleh anak (tidak perlu kata−kata yang lengkap). Apakah ia mencoba meniru kata-kata tadi?", 0, "", ""],
    ["GK", "Tanyakan kepada ibu atau pengasuh, apakah anak dapat mengangkat badannya ke posisi berdiri tanpa bantuan?", 0, "n", ""],
    ["GK", "Tanyakan kepada ibu atau pengasuh, apakah anak dapat duduk sendiri tanpa bantuan dari posisi tidur atau tengkurap?", 0, "n", ""],
    ["BB", "Tanyakan kepada ibu atau pengasuh, apakah anak dapat memahami makna kata ’jangan’?", 1, "nk", ""],
    ["SK", "Tanyakan kepada ibu atau pengasuh, apakah anak akan mencari atau terlihat mengharapkan muncul kembali jika ibu atau pengasuh bersembunyi di belakang sesuatu atau di pojok, kemudian muncul dan menghilang secara berulang-ulang di hadapan anak?", 1, "nk", ""],
    ["SK", "Tanyakan kepada ibu atau pengasuh, apakah anak dapat membedakan ibu atau pengasuh dengan orang yang belum ia kenal? Ia akan menunjukkan sikap malu-malu atau ragu-ragu pada saat permulaan bertemu dengan orang yang belum dikenalnya.", 1, "n", ""],
    ["GK", "Berdirikan anak. Apakah anak dapat berdiri dengan berpegangan pada kursi atau meja selama 30 detik atau lebih?", 0, "", "Kursi atau meja yang kokoh"]
  ],
  15: [
    ["GH", "Bayi dipangku orang tua atau pengasuh. Berikan 2 kubus kepada anak. Tanpa bantuan, apakah anak dapat mempertemukan 2 kubus kecil yang ia pegang?", 1, "", "2 kubus kecil"],
    ["GH", "Bayi dipangku orang tua atau pengasuh. Berikan sebuah kubus dan cangkir. Apakah anak dapat memasukkan 1 kubus ke dalam cangkir?", 0, "k", "1 kubus dan cangkir"],
    ["GK", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat berjalan dengan berpegangan?", 0, "n", ""],
    ["BB", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat mengatakan ‘papa’ ketika ia memanggil atau melihat ayahnya, atau mengatakan ‘mama’ jika memanggil atau melihat ibunya? Jawab ‘Ya’ bila anak mengatakan salah satu di antaranya.", 0, "n", ""],
    ["BB", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat mengucapkan 1 kata yang bermakna selain ‘mama’, ‘papa’, atau nama panggilan orang?", 0, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat bertepuk tangan atau melambai-lambai tanpa bantuan? Jawab ‘Tidak’ bila ia membutuhkan bantuan.", 1, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat menunjukkan apa yang diinginkannya tanpa menangis atau merengek? Jawab ‘Ya’ bila ia menunjuk, menarik atau mengeluarkan suara yang menyenangkan.", 1, "n", ""],
    ["GK", "Coba berdirikan anak. Apakah anak dapat berdiri sendiri tanpa berpegangan selama 30 detik atau lebih?", 0, "", ""],
    ["GK", "Letakkan kubus di lantai, tanpa berpegangan atau menyentuh lantai, apakah anak dapat membungkuk untuk memungut kubus di lantai dan kemudian berdiri kembali?", 1, "", "Kubus"],
    ["GK", "Apakah anak dapat berjalan di sepanjang ruangan tanpa jatuh atau terhuyung-huyung?", 0, "", ""]
  ],
  18: [
    ["GH", "Bayi dipangku orang tua atau pengasuh. Berikan anak sebuah pensil dan kertas. Apakah anak dapat mencoret-coret kertas tanpa bantuan atau petunjuk?", 0, "", "Pensil dan kertas"],
    ["BB", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat menyebutkan sedikitnya 3 kata yang bermakna?", 1, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat menunjukkan apa yang diinginkannya tanpa menangis atau merengek?", 0, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat minum dari cangkir atau gelas sendiri tanpa banyak yang tumpah?", 0, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, apakah anak suka meniru bila ibu atau pengasuh sedang melakukan pekerjaan rumah tangga (merapikan mainan, menyapu, dll)?", 1, "n", ""],
    ["GH", "Gelindingkan bola tenis ke arah anak. Apakah anak dapat menggelindingkan atau melempar bola tersebut kembali kepada Anda?", 1, "", "Bola tenis"],
    ["GK", "Letakkan kubus di lantai, tanpa berpegangan atau menyentuh lantai, apakah anak dapat membungkuk untuk memungut kubus di lantai dan kemudian berdiri kembali?", 1, "", "Kubus"],
    ["GK", "Minta anak untuk berjalan sepanjang ruangan. Dapatkah ia berjalan tanpa terhuyung-huyung atau terjatuh?", 0, "", ""],
    ["GK", "Dapatkah anak berjalan mundur minimal 5 langkah tanpa kehilangan keseimbangan?", 1, "", ""],
    ["BB", "Berikan anak perintah berikut ini dengan bantuan telunjuk atau isyarat:\n" + TEKS_PERINTAH + "\nDapatkah anak melakukan perintah tersebut dengan bantuan telunjuk atau isyarat?", 0, "k", "Kertas dan pensil"]
  ],
  21: [
    ["GH", "Bayi dipangku orang tua atau pengasuh. Berikan anak sebuah pensil dan kertas. Apakah anak dapat mencoret-coret kertas tanpa bantuan atau petunjuk?", 0, "", "Pensil dan kertas"],
    ["GH", "Bayi dipangku orang tua atau pengasuh. Minta anak untuk menyusun kubus. Apakah anak dapat menyusun 2 kubus?", 1, "", "Kubus"],
    ["BB", "Bayi dipangku orang tua atau pengasuh. Tunjukkan gambar di bawah pada anak dan minta ia untuk menunjuk gambar sesuai dengan yang Anda sebutkan namanya. Apakah anak dapat menunjuk minimal 1 gambar?", 1, "k", "Gambar di bawah (tampilkan di layar)", "21-3", IMG_HEWAN],
    ["BB", "Bayi dipangku orang tua atau pengasuh. Tanpa bimbingan, petunjuk, atau bantuan Anda, dapatkah anak menunjuk paling sedikit 1 bagian tubuhnya dengan benar (rambut, mata, hidung, mulut, atau bagian badan yang lain)?", 0, "k", ""],
    ["BB", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat mengucapkan minimal 7 kata yang mempunyai arti (selain kata ‘mama’ dan ‘papa’)?", 1, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat minum dari cangkir atau gelas sendiri tanpa banyak yang tumpah?", 0, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, apakah anak suka meniru bila ibu atau pengasuh sedang melakukan pekerjaan rumah tangga (merapikan mainan, menyapu, dll)?", 1, "n", ""],
    ["GK", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat berlari tanpa terjatuh?", 1, "n", ""],
    ["GK", "Letakkan kubus di lantai, tanpa berpegangan atau menyentuh lantai, apakah anak dapat membungkuk untuk memungut kubus di lantai dan kemudian berdiri kembali?", 0, "", "Kubus"],
    ["GK", "Dapatkah anak berjalan mundur minimal 5 langkah tanpa kehilangan keseimbangan?", 1, "", ""]
  ],
  24: [
    ["GH", "Bayi dipangku orang tua atau pengasuh. Berikan anak sebuah pensil dan kertas. Apakah anak dapat mencoret-coret kertas tanpa bantuan atau petunjuk?", 1, "", "Pensil dan kertas"],
    ["GH", "Bayi dipangku orang tua atau pengasuh. Minta anak untuk menyusun kubus. Apakah anak dapat menyusun 4 kubus?", 0, "", "Kubus"],
    ["BB", "Bayi dipangku orang tua atau pengasuh. Tanpa bimbingan, petunjuk, atau bantuan Anda, dapatkah anak menunjuk paling sedikit 2 bagian tubuhnya dengan benar (rambut, mata, hidung, mulut, atau bagian badan yang lain)?", 1, "k", ""],
    ["BB", "Tanyakan kepada orang tua atau pengasuh, apakah anak mampu menggabungkan 2 kata berbeda ketika berbicara, misalnya “Minum susu” atau “Main bola”? “Terima kasih” dan “Da-dah” tidak termasuk.", 0, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat melepas pakaiannya seperti baju, rok, atau celana?", 0, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat makan dengan menggunakan sendok sendiri tanpa banyak yang tumpah?", 0, "n", ""],
    ["GK", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat berlari tanpa terjatuh?", 0, "n", ""],
    ["GK", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat berjalan naik tangga sendiri? Jawab ‘Ya’ jika ia naik tangga dengan posisi tegak atau berpegangan pada dinding atau pegangan tangga. Jawab ‘Tidak’ jika ia naik tangga dengan merangkak, orang tua tidak memperbolehkan anak naik tangga, atau anak harus berpegangan pada seseorang.", 1, "n", ""],
    ["GK", "Letakkan bola tenis di depan kaki anak. Apakah ia dapat menendang ke depan tanpa berpegangan pada apapun?", 1, "", "Bola tenis"],
    ["BB", "Ikuti perintah dengan seksama. Jangan memberi isyarat dengan telunjuk atau mata pada saat memberikan perintah berikut ini:\n" + TEKS_PERINTAH + "\nDapatkah anak melakukan perintah tersebut?", 1, "k", "Kertas dan pensil"]
  ],
  30: [
    ["GH", "Beri kubus di depan anak. Dapatkah anak menyusun 4 buah kubus menyerupai kereta api dengan cerobong asap (dicontohkan)?", 0, "k", "4 kubus", "30-1"],
    ["GH", GARIS, 1, "", "Pensil dan kertas", "lines", IMG_GARIS],
    ["BB", "Tanpa bimbingan, petunjuk, atau bantuan Anda, dapatkah anak menyebut 2 gambar di antara gambar-gambar di bawah dengan benar? Menyebut dengan suara binatang tidak ikut dinilai.", 1, "k", "Gambar di bawah (tampilkan di layar)", "30-3", IMG_HEWAN],
    ["BB", "Tanpa bimbingan, petunjuk, atau bantuan Anda, dapatkah anak menunjuk 4 gambar di antara gambar-gambar di atas ini dengan benar ketika Anda sebutkan namanya?", 1, "k", "Gambar pada butir 3 (tampilkan di layar)", "30-3", IMG_HEWAN],
    ["BB", "Tanpa bimbingan, petunjuk, atau bantuan Anda, dapatkah anak menunjuk paling sedikit 6 bagian tubuhnya?", 1, "k", ""],
    ["BB", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat memahami perintah yang terdiri dari 2 langkah, misalnya “Tolong ambil bola dan berikan kepada Ayah”?", 0, "nk", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, dapatkah anak berpakaian sendiri seperti baju, rok, celana (topi dan kaos kaki tidak ikut dinilai)?", 0, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, dapatkah anak bermain peran, misalnya menyuapi boneka?", 1, "nk", ""],
    ["GK", "Letakkan bola tenis di depan kaki anak. Dapatkah anak menendang ke depan tanpa berpegangan pada apapun? Mendorong bola tidak ikut dinilai.", 1, "", "Bola tenis"],
    ["GK", "Minta anak untuk melompat atau mengangkat kedua kakinya pada saat bersamaan. Dapatkah ia melakukannya?", 0, "", ""]
  ],
  36: [
    ["GH", "Beri kubus di depan anak. Dapatkah anak menyusun 6 buah kubus satu persatu di atas kubus yang lain tanpa menjatuhkan kubus tersebut?", 1, "", "6 kubus"],
    ["GH", GARIS, 0, "", "Pensil dan kertas", "lines", IMG_GARIS],
    ["BB", "Tanpa bimbingan, petunjuk, atau bantuan Anda, dapatkah anak menyebut 4 gambar di antara gambar-gambar di bawah ini dengan benar? Menyebut dengan suara binatang tidak ikut dinilai.", 1, "k", "Gambar di bawah (tampilkan di layar)", "36-3", IMG_HEWAN],
    ["BB", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat memahami perintah yang terdiri dari 2 langkah, misalnya “Tolong ambil bola dan berikan kepada Ayah”?", 0, "nk", ""],
    ["BB", "Tanyakan kepada orang tua atau pengasuh, apakah sebagian dari bicara anak dapat dipahami oleh orang asing (yang tidak bertemu setiap hari)?", 0, "n", ""],
    ["BB", "Tanyakan kepada orang tua atau pengasuh, dapatkah anak merangkai kalimat sederhana yang terdiri dari minimal 3 kata, misalnya “Aku makan roti” atau ”Ibu minta susu”?", 0, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, dapatkah anak menggosok gigi dengan bantuan?", 0, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, dapatkah anak mengenakan baju, celana, atau sepatu sendiri (tidak termasuk mengancing dan menali)?", 0, "n", ""],
    ["GK", "Berikan kepada anak sebuah bola tenis. Minta ia untuk melemparkan ke arah dada Anda. Dapatkah anak melempar bola dengan lurus ke arah perut atau dada Anda dari jarak 1,5 meter?", 1, "", "Bola tenis"],
    ["GK", KERTAS, 0, "", "Selembar kertas seukuran buku"]
  ],
  42: [
    ["GH", GARIS, 0, "", "Pensil dan kertas", "lines", IMG_GARIS],
    ["GH", "Beri kubus di depan anak. Dapatkah anak menyusun 8 buah kubus satu persatu di atas kubus yang lain tanpa menjatuhkannya?", 1, "", "8 kubus"],
    ["BB", KEGIATAN, 1, "k", "Gambar di bawah (tampilkan di layar)", "42-3", IMG_HEWAN],
    ["BB", "Tanyakan kepada anak pertanyaan berikut ini satu persatu:\n“Apa yang kamu lakukan bila kedinginan?” Jawaban: pakai jaket, pakai selimut\n“Apa yang kamu lakukan bila kamu kelelahan?” Jawaban: tidur, berbaring, istirahat\n“Apa yang kamu lakukan bila kamu merasa lapar?” Jawaban: makan\n“Apa yang kamu lakukan bila kamu merasa haus?” Jawaban: minum\nApakah anak dapat menjawab 3 pertanyaan dengan benar tanpa gerakan dan isyarat?", 0, "k", ""],
    ["BB", "Minta anak untuk menyebut 1 warna. Dapatkah anak menyebut 1 warna dengan benar?", 1, "k", "Kotak warna di bawah (tampilkan di layar)", "42-5", IMG_WARNA],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat mencuci tangannya sendiri dengan baik setelah makan?", 0, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, dapatkah anak menyebut nama teman bermain di luar rumah atau saudara yang tidak tinggal serumah?", 1, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, dapatkah anak mengenakan kaos (T-shirt) tanpa dibantu?", 0, "n", ""],
    ["GK", KERTAS, 0, "", "Selembar kertas seukuran buku"],
    ["GK", SATU_KAKI(1), 0, "", ""]
  ],
  48: [
    ["GH", "Berikan contoh membuat jembatan dari 3 buah kubus, yaitu dengan meletakkan 2 kubus dengan sedikit jarak (kira kira satu jari), lalu letakkan balok ketiga di atas kedua balok sehingga terbentuk seperti jembatan. Minta anak untuk melakukan. Dapatkan anak melakukannya?", 1, "k", "3 kubus", "48-1"],
    ["GH", "Beri pensil dan kertas. Jangan membantu anak dan jangan menyebut lingkaran. Buatlah lingkaran di atas kertas tersebut. Minta anak menirunya. Dapatkah anak menggambar lingkaran?", 1, "", "Pensil dan kertas", "48-2"],
    ["BB", KEGIATAN.replace(/“Mana/g, "“Yang mana"), 0, "k", "Gambar di bawah (tampilkan di layar)", "48-3", IMG_HEWAN],
    ["BB", "Dapatkah anak menyebut nama lengkapnya tanpa dibantu? Jawab ‘Tidak’ jika ia menyebut sebagian namanya atau ucapannya sulit dimengerti.", 1, "", ""],
    ["BB", "Mengenal konsep angka satu\nLetakkan 5 kubus di atas meja dan selembar kertas di samping kubus. Katakan kepada anak “Ambil 1 kubus dan letakkan di atas kertas”. Setelah anak selesai meletakkan, tanyakan “Ada berapa banyak kubus di atas kertas?” Dapatkah anak melakukan dengan hanya mengambil satu kubus dan bisa menyebutkan “Satu”?", 0, "k", "5 kubus dan selembar kertas"],
    ["BB", "Tanyakan kepada anak pertanyaan di bawah satu persatu:\n“Apa kegunaan kursi?” Jawaban: untuk duduk\n“Apa kegunaan cangkir?” Jawaban: untuk minum\n“Apa kegunaan pensil?” Jawaban: untuk mencoret, menulis, menggambar\nDapatkah anak menjawab ketiga pertanyaan terkait kegunaan benda tersebut dengan benar?", 0, "k", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, dapatkah anak mengikuti peraturan permainan saat bermain dengan teman-temannya (misal: ular tangga, petak umpet, dll)?", 1, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, dapatkah anak mengenakan kaos (T-shirt) tanpa dibantu?", 0, "n", ""],
    ["GK", KERTAS, 0, "", "Selembar kertas seukuran buku"],
    ["GK", SATU_KAKI(2), 0, "", ""]
  ],
  54: [
    ["GH", "Jangan mengoreksi atau membantu anak. Jangan menyebut kata “Lebih panjang”. Perlihatkan gambar kedua garis ini pada anak. Tanyakan: “Mana garis yang lebih panjang?” Minta anak menunjuk garis yang lebih panjang. Setelah anak menunjuk, putar lembar ini dan ulangi pertanyaan tersebut. Apakah anak dapat menunjuk garis yang lebih panjang sebanyak 3 kali dengan benar?", 1, "k", "Gambar dua garis (tampilkan di layar)", "54-1"],
    ["GH", "Jangan membantu anak dan jangan memberitahu nama gambar ini. Minta anak untuk menggambar seperti contoh di kertas kosong yang tersedia. Berikan 3 kali kesempatan. Apakah anak dapat menggambar + seperti contoh di bawah?", 0, "", "Pensil dan kertas kosong", "54-2"],
    ["GH", ORANG(3, true), 0, "k", "Pensil dan kertas", "54-3", IMG_ORANG3],
    ["BB", "Memahami konsep 2 warna\nMinta anak untuk menyebutkan 2 warna. Dapatkah anak menyebut 2 warna dengan benar?", 0, "k", "Kotak warna di bawah (tampilkan di layar)", "54-4", IMG_WARNA],
    ["BB", "Tanyakan kepada orang tua atau pengasuh, apakah bicara anak mampu dipahami seluruhnya oleh orang lain (yang tidak bertemu setiap hari)?", 1, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, dapatkah anak mengikuti peraturan permainan saat bermain dengan teman-temannya (misal: ular tangga, petak umpet, dll)?", 1, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, dapatkah anak menggosok gigi tanpa dibantu?", 0, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat mengancingkan bajunya atau pakaian boneka?", 0, "n", ""],
    ["BB", KATA_DEPAN(2, "."), 0, "k", "Benda kecil (kertas atau balok) dan meja"],
    ["GK", SATU_KAKI(2), 0, "", ""]
  ],
  60: [
    ["GH", "Perlihatkan gambar kedua garis ini pada anak. Tanyakan: “Mana garis yang lebih panjang?” Minta anak menunjuk garis yang lebih panjang. Setelah anak menunjuk, putar lembar ini dan ulangi pertanyaan tersebut. Apakah anak dapat menunjuk garis yang lebih panjang sebanyak 3 kali dengan benar?", 0, "k", "Gambar dua garis (tampilkan di layar)", "60-1"],
    ["GH", ORANG(3), 1, "k", "Pensil dan kertas", "60-2", IMG_ORANG3],
    ["BB", "Memahami konsep 4 warna\nMinta anak untuk menyebutkan 4 warna. Dapatkah anak menyebut keempat warna tersebut dengan benar?", 1, "k", "Kotak warna di bawah (tampilkan di layar)", "60-3", IMG_WARNA],
    ["BB", "Tanyakan kepada anak pertanyaan berikut ini satu persatu:\n“Apa yang kamu lakukan saat kedinginan?” Jawaban: pakai jaket, pakai selimut\n“Apa yang kamu lakukan saat kelelahan?” Jawaban: tidur, berbaring, istirahat\n“Apa yang kamu lakukan saat merasa lapar?” Jawaban: makan\n“Apa yang kamu lakukan saat merasa haus?” Jawaban: minum\nDapatkah anak menjawab 3 pertanyaan terkait kata sifat tersebut dengan benar?", 0, "k", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat mengancingkan bajunya atau pakaian boneka?", 0, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, apakah anak bereaksi dengan tenang dan tidak rewel (tanpa menangis atau menggelayut) pada saat ditinggal oleh orang tua atau pengasuh?", 1, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, dapatkah anak sepenuhnya berpakaian sendiri tanpa dibantu?", 0, "n", ""],
    ["BB", KATA_DEPAN(4, ":"), 0, "k", "Benda kecil (kertas atau balok) dan meja"],
    ["GK", SATU_KAKI(4), 0, "", ""],
    ["GK", "Minta anak untuk melompat dengan 1 kaki beberapa kali tanpa berpegangan (lompatan dengan 2 kaki tidak ikut dinilai). Dapatkah anak melompat 2-3 kali dengan 1 kaki?", 0, "", ""]
  ],
  66: [
    ["GH", "Menggambar +\nJangan membantu anak dan jangan memberitahu nama gambar ini. Minta anak untuk menggambar seperti contoh di kertas kosong yang tersedia. Berikan 3 kali kesempatan. Apakah anak dapat menggambar + seperti contoh di bawah?", 0, "", "Pensil dan kertas kosong", "66-1"],
    ["GH", "Menggambar kotak dengan dicontohkan\nBerikan kepada anak pensil dan kertas. Tunjukkan kepada anak contoh gambar di bawah. Anda bisa mencontohkan cara membuat kotak. Dapatkah anak menggambar kotak seperti contoh di bawah?", 0, "", "Pensil dan kertas", "66-2"],
    ["GH", "Menggambar orang dengan sedikitnya 6 bagian tubuh\n" + ORANG(6), 1, "k", "Pensil dan kertas", "66-3"],
    ["BB", "Mengetahui konsep angka 5\nLetakkan 8 kubus di atas meja dan selembar kertas di samping kubus. Katakan kepada anak “Ambil 5 kubus dan letakkan di atas kertas”. Setelah anak selesai meletakkan, tanyakan “Ada berapa banyak kubus di atas kertas?” Dapatkah anak melakukannya?", 1, "k", "8 kubus dan selembar kertas"],
    ["BB", ARTI_KATA(5), 0, "k", ""],
    ["BB", "Mengetahui konsep analogi berlawanan\nMinta anak untuk melengkapi kalimat di bawah ini, jangan membantu kecuali mengulang pertanyaan:\n“Jika kuda besar, maka tikus...?” Jawaban: kecil\n“Jika api panas, maka es...?” Jawaban: dingin\n“Jika ibu seorang wanita, maka ayah seorang...” Jawaban: pria, laki-laki\nApakah anak menjawab ketiga pertanyaan dengan benar?", 0, "k", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, apakah anak bereaksi dengan tenang dan tidak rewel (tanpa menangis atau menggelayut) pada saat ditinggal oleh orang tua atau pengasuh?", 1, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, dapatkah anak sepenuhnya berpakaian sendiri tanpa dibantu?", 0, "n", ""],
    ["GK", SATU_KAKI(6), 0, "", ""],
    ["GK", "Apakah anak dapat menangkap bola kecil sebesar bola tenis atau bola kasti hanya dengan menggunakan kedua tangannya?", 1, "", "Bola tenis atau bola kasti"]
  ],
  72: [
    ["GH", "Menggambar kotak tanpa dicontohkan\nBerikan kepada anak pensil dan kertas. Tunjukkan kepada anak contoh gambar di bawah. Tanpa menyebutkan nama dan tanpa mencontohkan atau menggerakkan jari telunjuk atau pensil untuk menunjukkan bagaimana cara menggambarnya, katakan kepada anak “Gambarlah yang seperti gambar ini”. Lihat contoh di bawah untuk menilai gambar anak. Dapatkah anak menggambar kotak seperti contoh di bawah?", 0, "", "Pensil dan kertas", "72-1"],
    ["GH", "Menggambar orang dengan sedikitnya 6 bagian tubuh\n" + ORANG(6), 1, "k", "Pensil dan kertas", "72-2", IMG_ORANG3],
    ["BB", "Mengetahui konsep analogi berlawanan\nMinta anak untuk melengkapi kalimat di bawah ini, jangan membantu kecuali mengulang pertanyaan:\n“Jika kuda besar, maka tikus...?” Jawaban: kecil\n“Jika api panas, maka es...?” Jawaban: dingin\n“Jika ibu seorang wanita, maka ayah seorang...” Jawaban: pria, laki-laki\n“Jika pagi ada matahari, malam ada...” Jawaban: bulan\nApakah anak menjawab ketiga pertanyaan dengan benar?", 0, "k", ""],
    ["BB", ARTI_KATA(7), 0, "k", ""],
    ["BB", "Mengetahui komposisi benda\nIsi titik−titik di bawah ini dengan jawaban anak. Jangan membantu kecuali mengulangi pertanyaan sampai 3 kali bila anak menanyakannya.\n“Sendok dibuat dari apa?” Jawaban: besi, baja, plastik, kayu\n“Sepatu dibuat dari apa?” Jawaban: kulit, karet, kain, plastik, kayu\n“Pintu dibuat dari apa?” Jawaban: kayu, besi, kaca\nApakah anak dapat menjawab ketiga pertanyaan diatas dengan benar?", 0, "k", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat menggosok giginya tanpa bantuan?", 0, "n", ""],
    ["SK", "Tanyakan kepada orang tua atau pengasuh, apakah anak dapat menyiapkan dan mengambil makanan tanpa bantuan, termasuk menggunakan mangkok, sendok, menuangkan makanan dan susu ke mangkok tanpa banyak tumpah? Jawab ‘Ya’ jika anak dapat melakukannya, termasuk menuangkan susu dari beberapa jenis kotak atau wadah makanan.", 0, "n", ""],
    ["GK", "Apakah anak dapat menangkap bola kecil sebesar bola tenis atau bola kasti hanya dengan menggunakan kedua tangannya?", 1, "", "Bola tenis atau bola kasti"],
    ["GK", "Tunjukkan kepada anak bagaimana cara berjalan di garis lurus dengan menempatkan tumit dari 1 kaki di depan jari kaki lain. Berjalanlah 8 langkah, lalu minta anak untuk melakukannya. Berikan contoh dan kesempatan sebanyak 3 kali bila perlu. Dapatkah anak melakukannya sebanyak 4 langkah atau lebih dengan meletakkan tumit tidak lebih dari 2,5 cm dari jari kaki lain tanpa berpegangan?", 0, "", ""],
    ["GK", SATU_KAKI(11), 0, "", ""]
  ]
};
const FORM_AGES = Object.keys(KPSP).map(Number).sort((a, b) => a - b);
