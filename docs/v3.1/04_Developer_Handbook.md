# 04 - Developer Handbook (Lutheus v3.1)

## 1. Onboarding & Geliştirici Standartları

**Platform Ekibine Hoş Geldin.**
Lutheus v3.1 sıfır toleranslı (güvenlik, maliyet, hata açısından) bir Enterprise platformdur.

- **Ortam Kurulumu:** Geliştiricilerin bilgisayarında Docker kurulu olması yeterlidir. `docker-compose -f local-dev.yml up` ile local k8s (minikube/k3d), redis, ve postgres anında ayağa kalkar. SDB (Seed DB) scriptleri sadece anonymized veri içerir. Prod verisine asla erişiminiz olmayacak.
- **Domain-Driven Design (DDD):** İş kuralları `packages/shared-core/domain` içindedir. Backend (NestJS) sadece bu mantığı HTTP'ye sunan bir **adaptördür**. İhlal kararı Controller içinde verilmez.

## 2. CI/CD Security Gates

Git push veya Pull Request yapıldığında geçilmesi **ZORUNLU** kapılar:
1. **Linter & Format (Eslint/Prettier):** Tek bir warning dahi PR'ı bloklar.
2. **SAST (Static Application Security Testing):** SonarQube veya Semgrep üzerinden SQL Injection, eval(), insecure math, hardcoded secret araması. Bulgu anında reject edilir.
3. **Dependency Audit (`pnpm audit`):** Kritik düzey CVE varsa build durur.
4. **Test Coverage:** Core Unit test coverage minimum %90 olmalıdır.
5. **Mutation Testing (Stryker):** Kodun sahte olarak bozulup testlerin bunu yakalayıp yakalamadığı kontrol edilir. Testlere olan güveni ölçer.

## 3. SBOM (Software Bill of Materials) Template

Sistemdeki tüm third-party kütüphaneler CycloneDX (veya SPDX) formatında analiz edilerek izlenir. Böylece, açık kaynaklı herhangi bir bağımlılıktaki küresel bir zaafiyette sistemin neresinin yamalanması gerektiği saniyeler içerisinde haritalanabilir.

`bom.json` yapısı CI ortamında Github Actrion üzerinden `cyclonedx-node-npm` ile her başarılı commit'in ardından artifact olarak oluşturulur ve güvenli arşive aktarılır.
