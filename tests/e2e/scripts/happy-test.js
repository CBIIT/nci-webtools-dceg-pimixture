const should = require('chai').should();
const { expect } = require('chai');
const {Builder, By, Key, until} = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

describe('PIMixture Happy case test - fitting', function() {
    this.timeout(0);
    let driver,
        website,
        pwd = process.env.PWD;

    let clickOption = async function (selector, optionText, optionSelector=By.css('option')) {
        const selectInput = await driver.findElement(selector);
        const options = await selectInput.findElements(optionSelector);
        for (const option of options) {
            if (await option.getText() === optionText) {
                await option.click();
                break;
            }
        }
    };

    before(async function () {
        const url = process.env.TEST_WEBSITE;
        if (url) {
            driver = await new Builder()
                .forBrowser('chrome')
                .setChromeOptions(new chrome.Options().headless())
                .build();
            website = url.replace('\/$', '') + '/#fitting';
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

    it('Should be able to enter job name and select input file', async function() {
        // Enter job name
        const jobNameInput = await driver.findElement(By.id('jobName'));
        jobNameInput.sendKeys('smoke-test');
        // Enter input data file path
        const fileInput = await driver.findElement(By.id('csvFile'));
        await fileInput.sendKeys(pwd + '/e2e/data/bd.mock.data.csv');
        const designInput = await driver.findElement(By.id('design'));
        await driver.wait(until.elementIsEnabled(designInput), 5000);
    });

    it('Should be able to select parameters', async function() {
        //Select Sample Desing to be unweighted
        clickOption(By.id('design'), 'Cohort (Unweighted)');

        //Select Regression Model to be Weakly-parametric
        await clickOption(By.id('model'), 'Weakly-parametric');

        //Select C to be 'C_CIN3PLUS
        await clickOption(By.id('outcomeC-input'), 'C_CIN3PLUS');

        //Select L to be 'L_CIN3PLUS
        await clickOption(By.id('outcomeL-input'), 'L_CIN3PLUS');

        //Select R to be 'R_CIN3PLUS
        await clickOption(By.id('outcomeR-input'), 'R_CIN3PLUS');
    });

    it('Should be able to config covariates', async function() {
        //Select covariates to be RES_HPV16
        const covInput = await driver.findElement(By.id('covariate-selectized'));
        await covInput.click();
        await clickOption(By.className('selectize-dropdown-content'), 'RES_HPV16', By.className('option'));

        //Set covariate configurations
        const covBtn = await driver.findElement(By.id('referencesButton'));
        await covBtn.click();
        await driver.wait(until.elementLocated(By.name('RES_HPV16_type')), 2000);
        selectInput = await driver.findElement(By.name('RES_HPV16_type'));
        options = await selectInput.findElements(By.css('option'));
        expect(options.length).to.equal(3);
        var tries = 1;
        while (tries <= 2) {
            try {
                for (const option of options) {
                    if (await option.getText() === 'Continuous') {
                        await option.click();
                        break;
                    }
                }
            } catch (e) {
                tries++;
            }
        }

    });

    it('Should be able to run fitting', async function(){
        const saveBtn = await driver.findElement(By.id('saveCovariatesBtn'));
        await saveBtn.click();

        //Submit form
        const form = await driver.findElement(By.id('calculationForm'));
        await form.submit();
        const submitBtn = await driver.findElement(By.id('run'));
        await driver.wait(until.elementLocated(By.id('runPredictionBtn')), 10000);
        const result = await driver.findElement(By.id('runPredictionBtn'));
        expect(result).to.exist;
        await driver.sleep(5000);
    });

});

describe('PIMixture Happy case test - prediction', function() {
    this.timeout(0);
    let driver,
        website,
        pwd = process.env.PWD;
    before(async function () {
        const url = process.env.TEST_WEBSITE;
        if (url) {
            driver = await new Builder()
                .forBrowser('chrome')
                .setChromeOptions(new chrome.Options().headless())
                .build();
            website = url.replace('\/$', '') + '/#prediction';
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

    it('Should be able to select model file', async function() {
        const fileInput = await driver.findElement(By.id('rdsFile'));
        await fileInput.sendKeys(pwd + '/e2e/data/smoke-test_fitting.rds');
        const fileLabel = await driver.findElement(By.id('modelFileName'));
        await driver.wait(until.elementTextContains(fileLabel, 'smoke-test_fitting'), 5000);
    });

    it('Should be able to select test data file', async function() {
        const fileInput = await driver.findElement(By.id('testDataFile'));
        await fileInput.sendKeys(pwd + '/e2e/data/bd.mock.TestData.csv');
        const fileLabel = await driver.findElement(By.id('testDataFileName'));
        const submitBtn = await driver.findElement(By.id('runPredict'));
        await driver.wait(until.elementIsEnabled(submitBtn), 2000);
    });

    it('Should be able to enter time points', async function() {
        const beginInput = await driver.findElement(By.id('begin'));
        const endInput = await driver.findElement(By.id('end'));
        const stepSizeInput = await driver.findElement(By.id('stepSize'));
        beginInput.sendKeys('1');
        endInput.sendKeys('20');
        stepSizeInput.sendKeys('1');
        const submitBtn = await driver.findElement(By.id('runPredict'));
        await submitBtn.submit();
        await driver.wait(until.elementsLocated(By.linkText('Download result (.csv) file')), 5000);
        await driver.sleep(5000);
    });

});