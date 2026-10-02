"use strict";
/* Aktivitas stimulasi per kelompok umur dan domain: [judul, cara melakukan].
   Kelompok dipilih dari umur formulir KPSP (min = umur formulir terkecil yang memakai kelompok ini).
   Indeks aktivitas dirujuk oleh kolom ke-3 setiap butir KPSP (tabel pemetaan butir ke aktivitas).

   Konten ini draf adaptasi dari Buku Bagan SDIDTK dan harus ditelaah pakar tumbuh kembang
   sebelum dipakai. Isi STIM_META setelah telaah. */
const STIM_META = {
  sumber: "Buku Bagan SDIDTK (Kemenkes RI, 2022), diadaptasi",
  peninjau: "Belum ditelaah ahli",
  tanggal: "Belum ditelaah"
};

const STIMULASI = [
  { min: 3, label: "3–6 bulan",
    GK: [["Tengkurap sambil bermain", "Beberapa kali sehari saat bayi bangun, letakkan ia tengkurap di alas datar dan taruh mainan berwarna di depannya supaya ia mengangkat kepala. Selalu awasi."],
         ["Latihan menarik ke posisi duduk", "Saat bayi telentang, pegang kedua tangannya lalu tarik perlahan ke posisi setengah duduk dan kembalikan. Gerakan ini melatih otot leher."]],
    GH: [["Mengikuti benda dengan mata", "Gerakkan mainan berwarna atau kerincingan perlahan dari satu sisi ke sisi lain, sekitar 30 cm di depan wajahnya."],
         ["Menggenggam mainan", "Letakkan kerincingan kecil di telapak tangannya supaya ia menggenggam, lalu biarkan ia menggoyangkannya."]],
    BB: [["Ajak bicara dan tunggu balasan", "Bicara dengan wajah dekat, lalu diam sejenak dan tunggu ia mengoceh. Balas ocehannya seperti sedang bercakap."],
         ["Bernyanyi setiap hari", "Nyanyikan lagu anak saat memandikan atau mengganti popok. Nada yang berulang membantu ia mengenal suara."]],
    SK: [["Senyum dan tatap mata", "Saat menyusui atau menggendong, tatap matanya dan tersenyum. Balas setiap senyumnya."],
         ["Main cilukba", "Tutup wajah Anda dengan tangan lalu buka sambil berkata “ba!”. Ulangi selama bayi masih senang."]] },
  { min: 6, label: "6–12 bulan",
    GK: [["Latihan duduk", "Dudukkan bayi dengan bantal di sekelilingnya dan letakkan mainan di depannya. Kurangi sandaran sedikit demi sedikit."],
         ["Merangkak dan berdiri berpegangan", "Letakkan mainan sedikit di luar jangkauannya supaya ia merangkak. Setelah bisa, biarkan ia berdiri berpegangan pada kursi atau meja yang kokoh."]],
    GH: [["Memindahkan mainan antartangan", "Berikan satu mainan, lalu sodorkan mainan kedua ke tangan yang sama supaya ia memindahkan mainan pertama."],
         ["Memungut benda kecil", "Dengan pengawasan, taruh potongan biskuit kecil di meja dan biarkan ia memungutnya dengan jari. Jauhkan benda yang bisa tertelan."]],
    BB: [["Menyebut nama benda", "Tunjuk dan sebut nama benda di sekitarnya: “ini bola”, “itu kucing”. Ulangi di situasi yang sama setiap hari."],
         ["Memanggil namanya", "Panggil namanya dari samping atau belakang, lalu tersenyum saat ia menoleh."]],
    SK: [["Makan biskuit sendiri", "Berikan biskuit yang mudah lumer dan biarkan ia memegang serta memakannya sendiri sambil diawasi."],
         ["Melambai dan bertepuk tangan", "Lambaikan tangan sambil berkata “dadah” dan bertepuklah saat bernyanyi. Bantu gerakkan tangannya bila perlu."]] },
  { min: 12, label: "12–18 bulan",
    GK: [["Berjalan dari berpegangan ke sendiri", "Pegang satu tangannya saat berjalan, lalu lepaskan sedikit demi sedikit di tempat yang aman dan tidak licin."],
         ["Membungkuk memungut mainan", "Taruh mainan di lantai dan minta ia mengambilnya lalu berdiri kembali."]],
    GH: [["Memasukkan benda ke wadah", "Sediakan wadah dan beberapa balok atau tutup botol besar. Tunjukkan cara memasukkan dan mengeluarkannya."],
         ["Membenturkan dan menumpuk balok", "Beri dua balok, peragakan cara membenturkan dan menumpuk, lalu biarkan ia mencoba."]],
    BB: [["Menirukan kata", "Ucapkan kata pendek yang mudah (mama, papa, mimi) dan tunggu ia menirukan. Puji setiap usahanya."],
         ["Tunjuk lalu sebut", "Saat ia menunjuk sesuatu, sebutkan namanya: “oh, burung!”. Ini mengajarkan bahwa kata punya arti."]],
    SK: [["Minum dari gelas", "Beri gelas plastik berisi sedikit air dan biarkan ia belajar memegang dan minum sendiri."],
         ["Meminta dengan menunjuk", "Saat ia menginginkan sesuatu, tunggu ia menunjuk atau mengucapkan sesuatu sebelum Anda memberikannya."]] },
  { min: 18, label: "18–24 bulan",
    GK: [["Naik tangga", "Dampingi anak naik tangga sambil berpegangan pada pegangan tangga atau tangan Anda."],
         ["Menendang bola", "Letakkan bola di depan kakinya dan contohkan cara menendang. Mainkan juga berjalan mundur sambil menarik mainan."]],
    GH: [["Mencoret-coret", "Beri krayon besar dan kertas lebar. Biarkan ia mencoret bebas tanpa dikoreksi."],
         ["Menara balok", "Susun 2–4 balok bersama. Biarkan ia menambah balok dan merobohkannya."]],
    BB: [["Menunjuk bagian tubuh", "Nyanyikan lagu yang menyebut kepala, mata, dan hidung sambil menunjuk. Lalu minta ia menunjuk sendiri."],
         ["Buku bergambar", "Lihat buku bergambar bersama, tunjuk gambar dan sebut namanya. Tanyakan “mana kucing?”."]],
    SK: [["Makan sendiri", "Beri sendok dan biarkan ia makan sendiri walaupun berantakan."],
         ["Melepas pakaian", "Biarkan ia melepas celana atau baju yang longgar sendiri sebelum mandi."]] },
  { min: 24, label: "24–36 bulan",
    GK: [["Melompat", "Ajak melompat dengan dua kaki di tempat, misalnya pura-pura menjadi kelinci."],
         ["Berjalan mundur dan melempar bola", "Mainkan permainan berjalan mundur, naik tangga, dan melempar bola ke arah Anda."]],
    GH: [["Menyusun balok lebih tinggi", "Tantang ia menyusun 4–6 balok menjadi menara."],
         ["Menggambar garis", "Buat garis lurus dari atas ke bawah di kertas dan ajak ia menirukannya."]],
    BB: [["Kalimat dua kata", "Perluas ucapannya: bila ia berkata “susu”, balas “mau susu?”. Tambahkan satu kata tanpa menyuruhnya mengulang."],
         ["Menyebut dan menunjuk gambar", "Tunjuk gambar hewan atau benda dan minta ia menyebut atau menunjuk yang Anda sebut."]],
    SK: [["Mencuci tangan sendiri", "Ajari mencuci dan mengeringkan tangan sebelum makan dengan urutan yang sama setiap hari."],
         ["Meniru pekerjaan rumah", "Beri lap kecil atau sapu mainan dan biarkan ia ikut membantu."]] },
  { min: 36, label: "36–48 bulan",
    GK: [["Berdiri satu kaki", "Main “bangau”: berdiri dengan satu kaki sambil menghitung sampai tiga, bergantian kaki."],
         ["Melempar dan menangkap", "Lempar bola besar dari jarak dekat dan minta ia menangkap dengan dua tangan."]],
    GH: [["Menggambar lingkaran", "Buat lingkaran perlahan di depannya dan ajak ia menirukan dengan krayon besar."],
         ["Meronce dan menyusun", "Ajak meronce manik besar, menyusun balok, atau menggunting kertas dengan gunting anak yang aman."]],
    BB: [["Kata posisi", "Main petak umpet mainan dan beri petunjuk “di atas meja” atau “di bawah kursi”."],
         ["Mengenal warna dan gambar", "Sebut warna benda di sekitar: “bajumu merah”. Lalu minta ia mencari benda berwarna sama atau menyebut nama gambar."]],
    SK: [["Berpakaian sendiri", "Beri waktu ia memakai baju atau celana sendiri. Pilih pakaian yang mudah dipakai."],
         ["Bermain dengan aturan", "Ajak bermain petak umpet atau ular naga bersama anak lain, dengan aturan yang dijelaskan singkat."]] },
  { min: 48, label: "48–60 bulan",
    GK: [["Melompat satu kaki", "Buat garis di lantai dan ajak ia melompat dengan satu kaki melewatinya. Latih juga berdiri satu kaki."],
         ["Mengayuh sepeda roda tiga", "Beri kesempatan bermain sepeda roda tiga di tempat yang aman."]],
    GH: [["Menggambar tanda tambah dan orang", "Contohkan gambar tanda + lalu gambar orang, dan ajak ia menambah bagian tubuh satu per satu."],
         ["Menyalin bentuk", "Buat bentuk sederhana (lingkaran, tanda silang) dan ajak ia menyalinnya."]],
    BB: [["Tanya kegunaan dan alasan", "Tanyakan “sendok untuk apa?” atau “apa yang kamu lakukan kalau lapar?”. Bantu dengan awal kalimat bila ia terhenti."],
         ["Bercerita", "Minta ia menceritakan kegiatan hari ini atau isi buku dengan pola “pertama, lalu, akhirnya”."]],
    SK: [["Merawat diri sendiri", "Biarkan ia menggosok gigi dan berpakaian sendiri, lalu Anda merapikannya."],
         ["Berpisah dengan tenang", "Latih berpisah sebentar, misalnya dititipkan ke kerabat, dengan pamit yang jelas dan kembali tepat waktu."]] },
  { min: 60, label: "60–72 bulan",
    GK: [["Berjalan di atas garis", "Buat garis lurus di lantai dan ajak ia berjalan dengan tumit menyentuh ujung jari kaki. Latih juga berdiri dan melompat satu kaki."],
         ["Menangkap bola kecil", "Lempar bola kecil dari jarak satu meter dan minta ia menangkap dengan dua tangan."]],
    GH: [["Menyalin kotak dan segitiga", "Contohkan menggambar kotak dan segitiga, lalu ajak ia menirukannya."],
         ["Menggambar orang dan menulis nama", "Ajak menggambar orang selengkap mungkin, lalu tulis namanya dengan huruf besar dan ajak ia menyalinnya."]],
    BB: [["Lawan kata dan arti kata", "Main tebak lawan kata (“api panas, es…?”) dan minta ia menjelaskan arti kata sehari-hari."],
         ["Berhitung benda", "Hitung benda sehari-hari sambil menunjuk satu per satu, lalu tanyakan “ada berapa?”."]],
    SK: [["Mengancingkan baju", "Latih mengancingkan baju yang kancingnya besar, mulai dari kancing bawah."],
         ["Permainan bergiliran", "Mainkan ular tangga atau kartu bergantian dan latih menunggu giliran."]] }
];

const STIM_RULES = [
  "Lakukan setiap hari dalam suasana senang, 5–10 menit sudah cukup. Berhenti saat anak bosan.",
  "Dampingi anak dan bantu sedikit di atas kemampuannya, tetapi jangan menyelesaikan tugas untuknya.",
  "Selipkan di rutinitas harian seperti mandi, makan, atau bermain.",
  "Puji usahanya, bukan hanya hasilnya."
];
