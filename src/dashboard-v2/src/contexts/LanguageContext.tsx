import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'tr';

const DEFAULT_LANGUAGE: Language = 'tr';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation / AppLayout
    'nav.home': 'Home',
    'nav.profile': 'Profile',
    'nav.staffProfiles': 'Staff Profiles',
    'nav.cases': 'Cases',
    'nav.staff': 'Staff',
    'nav.scan': 'Scan',
    'nav.pointtrain': 'Pointtrain',
    'nav.rules': 'CUK Editor',
    'nav.ai-agent': 'AI Agent',
    'nav.access': 'Access',
    'nav.announcements': 'Announcements',
    'nav.botSetup': 'Bot Setup',
    'nav.settings': 'Settings',
    'nav.logout': 'Logout',
    'nav.profileDetails': 'Profile Details',
    'nav.synced': 'Synced',
    'nav.pending': 'pending',
    'nav.syncing': 'Syncing...',
    'nav.sync': 'Sync',
    'nav.search': 'Search...',
    'nav.accessDenied': 'Access Denied',
    'nav.accessDeniedDesc': 'You do not have permission to access the moderation panel due to your role restrictions.',
    'nav.unauthorized': 'Unauthorized Access',
    'nav.unauthorizedDesc': 'You do not have permission to view or manage data on this page. Please contact administration.',
    'nav.appeals': 'Appeals',
    'nav.tickets': 'Tickets',
    'nav.applications': 'Applications',
    'nav.apply': 'Apply',
    'nav.ysymExam': 'YSYM Exam',
    'nav.manageForms': 'Forms',
    'nav.ysym': 'YSYM Control',
    
    // Home Page
    'home.title': 'Overview',
    'home.subtitle': 'Last {total} records',
    'home.copyReport': 'Copy Report',
    'home.refresh': 'Refresh',
    'home.statTotal': 'Total Cases',
    'home.statValid': 'Verified',
    'home.statInvalid': 'Invalid',
    'home.statActiveStaff': 'Active Staff',
    'home.weeklyTrend': 'Weekly Trend',
    'home.verdictDist': 'Verdict Distribution',
    'home.staffPerf': 'Staff Performance',
    'home.noData': 'No data available',
    'home.moderator': 'Staff',
    'home.total': 'Total',
    'home.accuracy': 'Accuracy',
    'home.status': 'Status',
    
    // Settings Page
    'settings.title': 'Settings',
    'settings.subtitle': 'System preferences, integrations, and access control.',
    'settings.general': 'General',
    'settings.account': 'Account and Access',
    'settings.appearance': 'Appearance',
    'settings.theme': 'Theme',
    'settings.layout': 'Panel Layout',
    'settings.layoutSide': 'Right Panel (Side)',
    'settings.layoutCenter': 'Center Modal (Center)',
    'settings.system': 'System',
    'settings.generalSettings': 'General Settings',
    'settings.guildId': 'Guild ID',
    'settings.scanDelay': 'Scan Delay (ms)',
    'settings.cukEnabled': 'CUK Verification Enabled',
    'settings.autoValidate': 'Automatic Case Verification',
    'settings.save': 'Save',
    'settings.integrations': 'Integrations',
    'settings.webhookApi': 'Webhook and API',
    'settings.webhookUrl': 'Discord Webhook URL',
    'settings.webhookUrlDesc': 'The channel where the bot will send scanning reports.',
    'settings.update': 'Update',
    'settings.botLogChannel': 'Bot Log Channel ID',
    'settings.syncProfiles': 'Sync Profiles',
    'settings.dangerZone': 'Danger Zone',
    'settings.resetTitle': 'Factory Reset',
    'settings.resetDesc': 'All case history, staff profiles, and logs will be deleted. This action is irreversible.',
    'settings.resetBtn': 'Reset System',
    'settings.purgeCasesTitle': 'Purge Only Cases',
    'settings.purgeCasesDesc': 'Deletes all case and penalty details from local storage and the database, but preserves staff details (staff ID, profile picture, roles).',
    'settings.purgeCasesBtn': 'Purge Cases Only',
    'settings.langSelect': 'Language Selection',
    'settings.langLabel': 'Dashboard Language',
    'settings.langEnglish': 'English',
    'settings.langTurkish': 'Turkish',
    'settings.langChangedEn': 'Language changed to English',
    'settings.langChangedTr': 'Language changed to Turkish',
    'status.reliable': 'Reliable',
    'status.risky': 'Risky',
    'status.monitoring': 'Monitoring',
    
    // Scan Page
    'scan.title': 'Scan Control',
    'scan.subtitle': 'Fetch data from Sapphire and sync locally.',
    'scan.targetPage': 'Target Page',
    'scan.targetPageDesc': '5 = page 5 only, 1-10 = page range',
    'scan.dateFilter': 'Date Filter',
    'scan.day': 'Day',
    'scan.week': 'Week',
    'scan.month': 'Month',
    'scan.all': 'All',
    'scan.advanced': 'Advanced Settings',
    'scan.detailed': 'Detailed Scan Mode',
    'scan.detailedDesc': 'Opens each case detail page. Slower but gathers complete evidence.',
    'scan.detailLimit': 'Detail Limit',
    'scan.detailLimitDesc': '0 = all cases',
    'scan.delay': 'Delay (ms)',
    'scan.openAdmin': 'Open Admin Panel when Completed',
    'scan.start': 'Start Scan',
    'scan.stop': 'Stop',
    'scan.activeScan': 'Active Scan',
    'scan.completed': 'Completed',
    'scan.error': 'Error',
    'scan.elapsed': 'Elapsed',
    'scan.localSync': 'Local Synchronization',
    'scan.localSyncDesc': 'Scraped cases are first saved locally, then synchronized with Supabase.',
    'scan.syncManual': 'Sync Manually',
    'scan.syncing': 'Synchronizing...',
    
    // Pointtrain Page
    'pt.title': 'Pointtrain Report',
    'pt.subtitle': '{rows} staff, {total} records',
    'pt.copyDiscord': 'Copy for Discord',
    'pt.csv': 'CSV',
    'pt.avgAccuracy': 'Avg. Accuracy',
    'pt.period7': 'Last 7 Days',
    'pt.period14': 'Last 14 Days',
    'pt.period30': 'Last 30 Days',
    'pt.periodAll': 'All Time',
    'pt.rank': 'Rank',
    'pt.score': 'Score',
    'pt.reliability': 'Reliability',
    'pt.valid': 'Valid',
    'pt.invalid': 'Invalid',
    'pt.pending': 'Pending',
    
    // AI Agent Page
    'ai.title': 'AI Decision Support',
    'ai.subtitle': 'Simulate punishment decisions using CUK rules.',
    'ai.welcome': 'Hello! I am the CUK decision support system. You can test compliance with rules by entering a punishment reason and duration. Example: "Insulting staff — 12 hours".',
    'ai.placeholder': 'Enter reason and duration... e.g. insult — 2 hours',
    'ai.warning': 'AI can make mistakes. Verify before applying punishment.',
    'ai.uploadError': 'Image upload failed.',
    'ai.uploadSuccess': 'Image uploaded successfully. Prompt updated.',
    'ai.visionReady': 'Image attached. Vision model will be used.',
    'ai.groqReport': '🤖 [Groq AI Analysis Report]',
    'ai.groqSummary': 'Summary',
    'ai.groqRisks': 'Detected Risks',
    'ai.groqAction': 'Recommended Action',
    'ai.groqConfidence': 'Confidence Note',
    'ai.engineVerdict': '🛡️ [CUK Decision Engine]',
    'ai.engineVerdictValid': 'Case is VALID.',
    'ai.engineVerdictInvalid': 'RULE VIOLATION or MISSING INFORMATION.',
    'ai.engineVerdictMsg': 'Reason',
    'ai.endpointError': 'AI Support service is currently unavailable. Using local engine only.',
    'ai.imageNotSaved': 'Note: Uploaded images are strictly processed in-memory and are never stored in the database.',

    // Cases Page
    'cases.title': 'Recent Cases',
    'cases.records': '{count} records',
    'cases.searchPlaceholder': 'Case ID, staff, or reason...',
    'cases.periodToday': 'Today',
    'cases.periodWeek': 'This Week',
    'cases.periodMonth': 'This Month',
    'cases.sortRecent': 'Date: Newest',
    'cases.sortOldest': 'Date: Oldest',
    'cases.selected': '{count} selected',
    'cases.approve': 'Approve',
    'cases.reject': 'Reject',
    'cases.clear': 'Clear',
    'cases.durationMins': '{mins} mins',
    'cases.permanent': 'Permanent',
    'cases.active': 'Active Punishment',
    'cases.expired': 'Expired / Removed',
    'cases.cukCategory': 'CUK Category',
    'cases.cukMessage': 'CUK Message',
    'cases.openSapphire': 'Open in Sapphire',
    'cases.bulkTitle': 'Bulk Action',
    'cases.bulkDesc': 'This action will update the status of all selected cases.',
    'cases.confirm': 'Confirm',
    'cases.cancel': 'Cancel',
    'cases.emptyState': 'No cases found matching filters.',
    'cases.punishedUser': 'Punished User',
    'cases.punishingStaff': 'Punishing Staff',
    'cases.details': 'Case Details',
    'cases.reason': 'Reason',
    'cases.duration': 'Duration',
    'cases.date': 'Date',
    'cases.successBulk': 'Successfully updated {count} cases',
    'cases.successSingle': 'Case #{id} updated successfully',
    'cases.loadError': 'An error occurred while loading cases',
    'cases.bulkUpdateError': 'An error occurred during bulk operation',
    'cases.singleUpdateError': 'An error occurred while saving the verdict',
    'cases.validateBtn': 'Verify {count} Pending',
    'cases.validateProgress': 'Verifying {count} pending cases...',
    'cases.validateSuccess': 'All pending cases successfully verified',
    'cases.validateError': 'An error occurred during verification',

    // Staff Page
    'staff.title': 'Staff List',
    'staff.subtitle': '{count} staff profiles',
    'staff.addBtn': 'Add Staff',
    'staff.searchPlaceholder': 'Search staff...',
    'staff.active': 'Active Staff ({count})',
    'staff.former': 'Former Staff ({count})',
    'staff.management': 'Staff Management',
    'staff.addTitle': 'Add New Staff',
    'staff.addSubtitle': 'Create a new moderator or staff record.',
    'staff.saving': 'Saving...',
    'staff.inGameName': 'In-Game Name',
    'staff.role': 'Rank / Role',
    'staff.activeLabel': 'Active Status',
    'staff.emptyState': 'No staff found matching filters.',
    'staff.emptyActive': 'No active staff found.',
    'staff.emptyFormer': 'No former staff registered.',
    'staff.successAdd': 'Successfully added new staff',
    'staff.successUpdate': 'Successfully updated staff profile',
    'staff.loadError': 'An error occurred while loading staff profiles',
    'staff.addError': 'An error occurred while adding staff',
    'staff.updateError': 'An error occurred while updating staff profile',

    // Tooltips for Settings Checkboxes
    'tooltip.cukEnabled.true': 'CUK Engine rules verification is active. Incoming cases are automatically checked for rule violations.',
    'tooltip.cukEnabled.false': 'CUK Engine rules verification is disabled. Incoming cases will not be audited against standard rules.',
    'tooltip.autoValidate.true': 'Automatic Case Verification is active. Cases that pass CUK validation are marked as valid immediately.',
    'tooltip.autoValidate.false': 'Automatic Case Verification is disabled. All new cases must be audited and verified manually.',
    'tooltip.detailedMode.true': 'Detailed Scan Mode is active. The scanner will fetch full evidence links, which is thorough but slower.',
    'tooltip.detailedMode.false': 'Detailed Scan Mode is disabled. The scanner will fetch cases from the list layout quickly without opening details.',
    'tooltip.openAdminOnDone.true': 'Admin view auto-navigation is active. The dashboard will automatically focus on home statistics upon scan completion.',
    'tooltip.openAdminOnDone.false': 'Admin view auto-navigation is disabled. The dashboard remains on this control page after scanning is done.'
  },
  tr: {
    // Navigation / AppLayout
    'nav.home': 'Ana Sayfa',
    'nav.profile': 'Profilim',
    'nav.staffProfiles': 'Yetkili Profilleri',
    'nav.cases': 'Cezalar',
    'nav.staff': 'Yetkililer',
    'nav.scan': 'Tarama',
    'nav.pointtrain': 'Pointtrain',
    'nav.rules': 'CUK Editörü',
    'nav.ai-agent': 'AI Agent',
    'nav.access': 'Erişim',
    'nav.announcements': 'Duyurular',
    'nav.botSetup': 'Bot Ayarları',
    'nav.settings': 'Ayarlar',
    'nav.logout': 'Çıkış Yap',
    'nav.profileDetails': 'Profil Detayları',
    'nav.synced': 'Senkronize',
    'nav.pending': 'bekleyen',
    'nav.syncing': 'Senkronize ediliyor...',
    'nav.sync': 'Senkronize Et',
    'nav.search': 'Ara...',
    'nav.accessDenied': 'Erişim Engellendi',
    'nav.accessDeniedDesc': 'Hesabınız veya rütbeniz engellendiği için moderasyon paneline erişim izniniz bulunmamaktadır.',
    'nav.unauthorized': 'Yetkisiz Erişim',
    'nav.unauthorizedDesc': 'Bu sayfadaki verileri görüntüleme veya yönetme yetkiniz bulunmamaktadır. Lütfen yönetim ile iletişime geçin.',
    'nav.appeals': 'İtirazlar',
    'nav.tickets': 'Biletler',
    'nav.applications': 'Başvurular',
    'nav.apply': 'Başvuru Yap',
    'nav.ysymExam': 'YSYM Sınavı',
    'nav.manageForms': 'Formlar',
    'nav.ysym': 'YSYM Kontrol',
    
    // Home Page
    'home.title': 'Genel Bakış',
    'home.subtitle': 'Son {total} kayıt',
    'home.copyReport': 'Rapor Kopyala',
    'home.refresh': 'Yenile',
    'home.statTotal': 'Toplam Ceza',
    'home.statValid': 'Doğrulanmış',
    'home.statInvalid': 'Hatalı',
    'home.statActiveStaff': 'Aktif Yetkili',
    'home.weeklyTrend': 'Haftalık Trend',
    'home.verdictDist': 'Durum Dağılımı',
    'home.staffPerf': 'Yetkili Performansı',
    'home.noData': 'Veri bulunamadı',
    'home.moderator': 'Yetkili',
    'home.total': 'Toplam',
    'home.accuracy': 'Doğruluk',
    'home.status': 'Durum',
    
    // Settings Page
    'settings.title': 'Ayarlar',
    'settings.subtitle': 'Sistem tercihleri, entegrasyonlar ve erişim kontrolü.',
    'settings.general': 'Genel',
    'settings.account': 'Hesap ve Erişim',
    'settings.appearance': 'Görünüm',
    'settings.theme': 'Tema',
    'settings.layout': 'Panel Yerleşimi',
    'settings.layoutSide': 'Sağ Panel (Side)',
    'settings.layoutCenter': 'Orta Modal (Center)',
    'settings.system': 'Sistem',
    'settings.generalSettings': 'Genel Ayarlar',
    'settings.guildId': 'Sunucu ID',
    'settings.scanDelay': 'Tarama Gecikmesi (ms)',
    'settings.cukEnabled': 'CUK Doğrulama Aktif',
    'settings.autoValidate': 'Otomatik Ceza Doğrulama',
    'settings.save': 'Kaydet',
    'settings.integrations': 'Entegrasyonlar',
    'settings.webhookApi': 'Webhook ve API',
    'settings.webhookUrl': 'Discord Webhook URL',
    'settings.webhookUrlDesc': 'Botun tarama raporlarını göndereceği kanal.',
    'settings.update': 'Güncelle',
    'settings.botLogChannel': 'Bot Log Kanal ID',
    'settings.syncProfiles': 'Profilleri Eşitle',
    'settings.dangerZone': 'Tehlikeli Bölge',
    'settings.resetTitle': 'Fabrika Ayarlarına Sıfırla',
    'settings.resetDesc': 'Tüm ceza geçmişi, yetkili profilleri ve loglar silinir. Bu işlem geri alınamaz.',
    'settings.resetBtn': 'Sistemi Sıfırla',
    'settings.purgeCasesTitle': 'Sadece Cezaları Sil',
    'settings.purgeCasesDesc': 'Tüm ceza detaylarını yerel hafızadan ve veritabanından siler, ancak yetkili ID, profil resmi ve roller gibi yetkili detaylarını korur.',
    'settings.purgeCasesBtn': 'Sadece Cezaları Temizle',
    'settings.langSelect': 'Dil Seçimi',
    'settings.langLabel': 'Dashboard Dili',
    'settings.langEnglish': 'İngilizce',
    'settings.langTurkish': 'Türkçe',
    'settings.langChangedEn': 'Dil İngilizce olarak değiştirildi',
    'settings.langChangedTr': 'Dil Türkçe olarak değiştirildi',
    'status.reliable': 'Güvenilir',
    'status.risky': 'Riskli',
    'status.monitoring': 'İzlemede',
    
    // Scan Page
    'scan.title': 'Tarama Kontrolü',
    'scan.subtitle': 'Sapphire\'dan veri çekme ve yerel senkronizasyon.',
    'scan.targetPage': 'Hedef Sayfa',
    'scan.targetPageDesc': '5 = sadece 5. sayfa, 1-10 = aralık',
    'scan.dateFilter': 'Tarih Filtresi',
    'scan.day': 'Gün',
    'scan.week': 'Hafta',
    'scan.month': 'Ay',
    'scan.all': 'Tümü',
    'scan.advanced': 'Gelişmiş Ayarlar',
    'scan.detailed': 'Detaylı Tarama Modu',
    'scan.detailedDesc': 'Her ceza detay sayfasını açar. Daha yavaş ama tam kanıt toplar.',
    'scan.detailLimit': 'Detay Limiti',
    'scan.detailLimitDesc': '0 = tüm cezalar',
    'scan.delay': 'Gecikme (ms)',
    'scan.openAdmin': 'Tamamlandığında Admin Paneli Aç',
    'scan.start': 'Taramayı Başlat',
    'scan.stop': 'Durdur',
    'scan.activeScan': 'Aktif Tarama',
    'scan.completed': 'Tamamlandı',
    'scan.error': 'Hata',
    'scan.elapsed': 'Geçen',
    'scan.localSync': 'Yerel Senkronizasyon',
    'scan.localSyncDesc': 'Tarama verileri önce yerel depoya kaydedilir, sonra Supabase\'e gönderilir.',
    'scan.syncManual': 'Elle Senkronize Et',
    'scan.syncing': 'Senkronize ediliyor...',
    
    // Pointtrain Page
    'pt.title': 'Pointtrain Raporu',
    'pt.subtitle': '{rows} yetkili, {total} kayıt',
    'pt.copyDiscord': 'Discord Kopyala',
    'pt.csv': 'CSV',
    'pt.avgAccuracy': 'Ort. Doğruluk',
    'pt.period7': 'Son 7 Gün',
    'pt.period14': 'Son 14 Gün',
    'pt.period30': 'Son 30 Gün',
    'pt.periodAll': 'Tümü',
    'pt.rank': 'Sıra',
    'pt.score': 'Skor',
    'pt.reliability': 'Durum',
    'pt.valid': 'Doğru',
    'pt.invalid': 'Hatalı',
    'pt.pending': 'Bekleyen',
    
    // AI Agent Page
    'ai.title': 'AI Karar Destek',
    'ai.subtitle': 'CUK kuralları üzerinden ceza türlerini simüle edin.',
    'ai.welcome': 'Merhaba! Ben CUK karar destek sistemi. Bir ceza sebebi ve süre girerek kurallarla uyumunu test edebilirsiniz. Örnek: "Yetkililere saygısızlık — 12 saat" gibi yazın.',
    'ai.placeholder': 'Sebep ve süre girin... örn: küfür — 2 saat',
    'ai.warning': 'AI hata yapabilir. Cezayı uygulamadan önce doğrulayın.',
    'ai.uploadError': 'Görsel yüklenemedi.',
    'ai.uploadSuccess': 'Görsel başarıyla yüklendi. Komut güncellendi.',
    'ai.visionReady': 'Görsel eklendi. Vision modeli kullanılacak.',
    'ai.groqReport': '🤖 [Groq AI Analiz Raporu]',
    'ai.groqSummary': 'Özet',
    'ai.groqRisks': 'Tespit Edilen Riskler',
    'ai.groqAction': 'Önerilen Aksiyon',
    'ai.groqConfidence': 'Güven Notu',
    'ai.engineVerdict': '🛡️ [CUK Karar Motoru]',
    'ai.engineVerdictValid': 'Ceza UYGUN.',
    'ai.engineVerdictInvalid': 'KURAL İHLALİ veya EKSİK BİLGİ.',
    'ai.engineVerdictMsg': 'Sebep',
    'ai.endpointError': 'AI Destek Servisi şu an kullanılamıyor (Kota aşılmış veya yetkisiz erişim). Yalnızca yerel CUK motoru sonuçları gösteriliyor.',
    'ai.imageNotSaved': 'Not: Yüklenen görseller tamamen geçici bellekte işlenir ve asla veritabanına kaydedilmez.',

    // Cases Page
    'cases.title': 'Son Cezalar',
    'cases.records': '{count} kayıt',
    'cases.searchPlaceholder': 'Case ID, yetkili veya sebep...',
    'cases.periodToday': 'Bugün',
    'cases.periodWeek': 'Bu Hafta',
    'cases.periodMonth': 'Bu Ay',
    'cases.sortRecent': 'Tarih: En Yakın (Yeni)',
    'cases.sortOldest': 'Tarih: En Uzak (Eski)',
    'cases.selected': '{count} seçildi',
    'cases.approve': 'Onayla',
    'cases.reject': 'Reddet',
    'cases.clear': 'Temizle',
    'cases.durationMins': '{mins} dk',
    'cases.permanent': 'Kalıcı',
    'cases.active': 'Aktif Cezalandırma',
    'cases.expired': 'Süresi Bitti / Kaldırıldı',
    'cases.cukCategory': 'CUK Kategori',
    'cases.cukMessage': 'CUK Mesaj',
    'cases.openSapphire': 'Sapphire\'da Aç',
    'cases.bulkTitle': 'Toplu İşlem',
    'cases.bulkDesc': 'Bu işlem seçili tüm cezaların durumunu değiştirecek.',
    'cases.confirm': 'Onayla',
    'cases.cancel': 'İptal',
    'cases.emptyState': 'Seçili filtrelere uygun ceza bulunamadı.',
    'cases.punishedUser': 'Cezalı Kullanıcı',
    'cases.punishingStaff': 'Cezalandıran Yetkili',
    'cases.details': 'Ceza Detayları',
    'cases.reason': 'Sebep',
    'cases.duration': 'Süre',
    'cases.date': 'Tarih',
    'cases.successBulk': '{count} adet ceza başarıyla güncellendi',
    'cases.successSingle': 'Case #{id} başarıyla güncellendi',
    'cases.loadError': 'Cezalar yüklenirken bir hata oluştu',
    'cases.bulkUpdateError': 'Toplu işlem gerçekleştirilirken hata oluştu',
    'cases.singleUpdateError': 'İşlem kaydedilirken bir hata oluştu',
    'cases.validateBtn': '{count} Bekleyeni Doğrula',
    'cases.validateProgress': '{count} bekleyen ceza doğrulanıyor...',
    'cases.validateSuccess': 'Bekleyen tüm cezalar başarıyla doğrulandı',
    'cases.validateError': 'Doğrulama işlemi sırasında hata oluştu',

    // Staff Page
    'staff.title': 'Yetkili Listesi',
    'staff.subtitle': '{count} yetkili',
    'staff.addBtn': 'Yetkili Ekle',
    'staff.searchPlaceholder': 'Yetkili ara...',
    'staff.active': 'Aktif Yetkililer ({count})',
    'staff.former': 'Eski Yetkililer ({count})',
    'staff.management': 'Yetkili Yönetimi',
    'staff.addTitle': 'Yeni Yetkili Ekle',
    'staff.addSubtitle': 'Yeni bir moderatör veya yetkili kaydı oluşturun.',
    'staff.saving': 'Kaydediliyor...',
    'staff.inGameName': 'Oyun İçi İsim',
    'staff.role': 'Rütbe / Rol',
    'staff.activeLabel': 'Aktif Yetkili',
    'staff.emptyState': 'Yetkili bulunamadı.',
    'staff.emptyActive': 'Aktif yetkili bulunamadı.',
    'staff.emptyFormer': 'Kayıtlı eski yetkili bulunmamaktadır.',
    'staff.successAdd': 'Yetkili başarıyla eklendi',
    'staff.successUpdate': 'Yetkili profili başarıyla güncellendi',
    'staff.loadError': 'Yetkili profilleri yüklenirken bir hata oluştu',
    'staff.addError': 'Yetkili eklenirken bir hata oluştu',
    'staff.updateError': 'Yetkili profili güncellenirken bir hata oluştu',

    // Tooltips for Settings Checkboxes
    'tooltip.cukEnabled.true': 'CUK Karar Motoru kurallar doğrulaması aktif. Gelen tüm cezalar otomatik olarak denetlenir.',
    'tooltip.cukEnabled.false': 'CUK Karar Motoru kurallar doğrulaması pasif. Gelen cezalar standart kurallarla denetlenmeyecektir.',
    'tooltip.autoValidate.true': 'Otomatik Ceza Doğrulama aktif. CUK denetiminden geçen cezalar anında doğrulanmış olarak işaretlenir.',
    'tooltip.autoValidate.false': 'Otomatik Ceza Doğrulama pasif. Yeni cezaların manuel olarak denetlenmesi ve doğrulanması gerekir.',
    'tooltip.detailedMode.true': 'Detaylı Tarama Modu aktif. Tarayıcı tam kanıt linklerini toplayacaktır, kapsamlı ancak daha yavaştır.',
    'tooltip.detailedMode.false': 'Detaylı Tarama Modu pasif. Tarayıcı detay sayfalarını açmadan hızlı bir şekilde liste üzerinden çekecektir.',
    'tooltip.openAdminOnDone.true': 'Admin paneli yönlendirmesi aktif. Tarama bittiğinde ana sayfa istatistiklerine otomatik geçilecektir.',
    'tooltip.openAdminOnDone.false': 'Admin paneli yönlendirmesi pasif. Tarama bittiğinde kontrol panelinde kalınacaktır.'
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function readStoredLanguage(): Language {
  if (typeof localStorage === 'undefined') return DEFAULT_LANGUAGE;
  const saved = localStorage.getItem('language');
  return saved === 'tr' || saved === 'en' ? saved : DEFAULT_LANGUAGE;
}

function syncChromeLanguage(lang: Language) {
  if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
    chrome.storage.local.set({ language: lang });
  }
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => readStoredLanguage());

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.get(['language'], (result) => {
        const stored = result?.language as string | undefined;
        if (stored === 'tr' || stored === 'en') {
          setLanguageState(stored);
          localStorage.setItem('language', stored);
        } else {
          syncChromeLanguage(DEFAULT_LANGUAGE);
          localStorage.setItem('language', DEFAULT_LANGUAGE);
        }
      });
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
    syncChromeLanguage(lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || translations['en'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
