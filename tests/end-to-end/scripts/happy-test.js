const should = require('chai').should();
const { expect } = require('chai');
const {Builder, By, Key, until} = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

describe('PIMixture Happy case test - fitting', function() {
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
        await fileInput.sendKeys(pwd + '/end-to-end/data/bd.mock.data.csv');
        const designInput = await driver.findElement(By.id('design'));
        await driver.wait(until.elementIsEnabled(designInput), 5000);
    });

    it('Should be able to select parameters', async function() {
        //Select Sample Desing to be unweighted
        var selectInput = await driver.findElement(By.id('design'));
        var options = await selectInput.findElements(By.css('option'));
        expect(options.length).to.equal(3);
        for (const option of options) {
            if (await option.getText() === 'Cohort (Unweighted)') {
                await option.click();
                break;
            }
        }
        //Select Regression Model to be Weakly-parametric
        selectInput = await driver.findElement(By.id('model'));
        options = await selectInput.findElements(By.css('option'));
        expect(options.length).to.equal(4);
        for (const option of options) {
            if (await option.getText() === 'Weakly-parametric') {
                await option.click();
                break;
            }
        }

        //Select C to be 'C_CIN3PLUS
        selectInput = await driver.findElement(By.id('outcomeC-input'));
        options = await selectInput.findElements(By.css('option'));
        expect(options.length).to.equal(5);
        for (const option of options) {
            if (await option.getText() === 'C_CIN3PLUS') {
                await option.click();
                break;
            }
        }

        //Select L to be 'L_CIN3PLUS
        selectInput = await driver.findElement(By.id('outcomeL-input'));
        options = await selectInput.findElements(By.css('option'));
        expect(options.length).to.equal(5);
        for (const option of options) {
            if (await option.getText() === 'L_CIN3PLUS') {
                await option.click();
                break;
            }
        }

        //Select R to be 'R_CIN3PLUS
        selectInput = await driver.findElement(By.id('outcomeR-input'));
        options = await selectInput.findElements(By.css('option'));
        expect(options.length).to.equal(5);
        for (const option of options) {
            if (await option.getText() === 'R_CIN3PLUS') {
                await option.click();
                break;
            }
        }
    });

    it('Should be able to config covariates', async function() {
        //Select covariates to be RES_HPV16
        const covInput = await driver.findElement(By.id('covariate-selectized'));
        await covInput.click();
        const dropDown = await driver.findElement(By.className('selectize-dropdown-content'));
        options = await dropDown.findElements(By.className('option'));
        for (const option of options) {
            if (await option.getText() === 'RES_HPV16') {
                option.click();
                break;
            }
        }
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
        await fileInput.sendKeys(pwd + '/end-to-end/data/smoke-test_fitting.rds');
        const fileLabel = await driver.findElement(By.id('modelFileName'));
        await driver.wait(until.elementTextContains(fileLabel, 'smoke-test_fitting'), 5000);
    });

    it('Should be able to select test data file', async function() {
        const fileInput = await driver.findElement(By.id('testDataFile'));
        await fileInput.sendKeys(pwd + '/end-to-end/data/bd.mock.TestData.csv');
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