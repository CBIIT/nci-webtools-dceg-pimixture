const { expect } = require('chai');
const {Builder, By, Key, until} = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');

describe('PIMixture Smoke test - home page', function() {
    this.timeout(0);
    let driver,
        website;
    before(async function() {
        const url = process.env.TEST_WEBSITE;
        if ( url ) {
            driver = await new Builder()
                .forBrowser('firefox')
                .setFirefoxOptions(new firefox.Options().headless())
                .build();
            website = url;
            await driver.get(website);
            await driver.wait(until.elementLocated(By.id('navigation-bar')), 20000);
        } else {
            console.log("No TEST_WEBSITE set");
            this.skip();
        }
    });

    after( async function(){
        driver.close();
    });

    it('Website should be set', function(){
        expect(website).to.be.a('string');
    });

    it('Should have title "Prevalence-Incidence Mixture Risk Models"', async function() {
        const title = await driver.getTitle();
        expect(title).is.equal('Prevalence-Incidence Mixture Risk Models');
    });

    it('Should have navigation bar', async function(){
        const nav = await driver.findElement(By.id('navigation-bar'));
        expect(nav).to.exist;
    });

    it('Should contains link to help page', async function(){
        const link = await driver.findElement(By.linkText('Help page'));
        const href = await link.getAttribute('href');
        expect(href).to.include('#help');
    });

});

describe('PIMixture Smoke test - fitting page', function() {
    this.timeout(0);
    let driver,
        website;
    before(async function () {
        const url = process.env.TEST_WEBSITE;
        if (url) {
            driver = await new Builder()
                .forBrowser('firefox')
                .setFirefoxOptions(new firefox.Options().headless())
                .build();
            website = url.replace('\/$', '') + '/#fitting';
            await driver.get(website);
            await driver.wait(until.elementLocated(By.id('calculationForm')), 20000);
        } else {
            console.log("No TEST_WEBSITE set");
            this.skip();
        }
    });

    after(async function () {
        driver.close();
    });

    it('Should have main form', async function(){
        const form = await driver.findElement(By.id('calculationForm'));
        expect(form).to.exist;
    });
});

describe('PIMixture Smoke test - prediction page', function() {
    this.timeout(0);
    let driver,
        website;
    before(async function () {
        const url = process.env.TEST_WEBSITE;
        if (url) {
            driver = await new Builder()
                .forBrowser('firefox')
                .setFirefoxOptions(new firefox.Options().headless())
                .build();
            website = url.replace('\/$', '') + '/#prediction';
            await driver.get(website);
            await driver.wait(until.elementLocated(By.id('predictionForm')), 20000);
        } else {
            console.log("No TEST_WEBSITE set");
            this.skip();
        }
    });

    after(async function () {
        driver.close();
    });

    it('Should have main form', async function(){
        const form = await driver.findElement(By.id('predictionForm'));
        expect(form).to.exist;
    });

});

describe('PIMixture Smoke test - help page', function() {
    this.timeout(0);
    let driver,
        website;
    before(async function () {
        const url = process.env.TEST_WEBSITE;
        if (url) {
            driver = await new Builder()
                .forBrowser('firefox')
                .setFirefoxOptions(new firefox.Options().headless())
                .build();
            website = url.replace('\/$', '') + '/#help';
            await driver.get(website);
            await driver.wait(until.elementLocated(By.id('navigation-bar')), 20000);
        } else {
            console.log("No TEST_WEBSITE set");
            this.skip();
        }
    });

    after(async function () {
        driver.close();
    });

    it('Should contains link to pdf download link', async function(){
        const link = await driver.findElement(By.linkText('Download Help in PDF.'));
        const href = await link.getAttribute('href');
        expect(href).to.include('files/PIMixture-manual.pdf');
    });

});

