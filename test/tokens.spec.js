const assert = require('assert');
const path = require('path');
const { Application } = require('spectron');
const moment = require('moment');
const { sleepApp } = require('./utils/sleepApp');
const TokenPage = require('./pages/tokenPage');

// construct paths
const baseDir = path.join(__dirname, '..');
const electronBinary = path.join(baseDir, 'node_modules', '.bin', 'electron');

//Prblemy:
//-> po jakims czasie nie da sie juz wysylac tokenow :/
// BUG -> ostatnia tranzakcja sie duplikuje :/
//Dodac -> sprawdzanie tranzakcji dla tego samego i konta gdzie sie wysyla
//kiedy wpisuje adres tokena do wyslania manualnie a automatycznie to dostaje inny komunikat


describe('Tokens main features tests: ', function () {
    this.timeout(500000);

    const app = new Application({
        path: electronBinary,
        args: [baseDir],
        env: {
            WEB_CLIENT: 'spectron',
        },
    });

    // page object
    const tokenPage = new TokenPage(app);

    beforeEach(async () => {
        await app.start();
        await tokenPage.selectLanguageAndAgreeToTerms();
        await tokenPage.setTestNode();
        await tokenPage.openExistingWallet(process.env.TZ1_PASSWORD);
    });

    afterEach(() => app.stop());

    it('tokens Balance Banner shows right data', async () => {
        await tokenPage.navigetToTokenSection('Token Sample');
        const pageData = await tokenPage.retrieveTokenBalanceBannerData();
        assert.equal(pageData.title, "Token Sample");
        assert.equal(pageData.addres, "KT1HzQofKBxzfiKoMzGbkxBgjis2mWnCtbC2");
        assert.equal(pageData.addresInfo.includes("Token is active."), true);
        assert.equal(pageData.addresInfo.includes("Total supply is"), true);
        // assert.equal(pageData.addresInfo.includes("2 001 140,000030."), true);
    })

    it('send tokens to proper recipient is visible in source account transaction', async () => {
        await tokenPage.navigetToTokenSection('Token Sample');
        await tokenPage.navigateToSection('Send');
        await tokenPage.sendTokens({
            recipientAddress: process.env.TZ2_ADDRESS,
            amount: 1,
            fee: "LOW",
            walletPassword: process.env.TZ1_PASSWORD,
            send: true
        })
        await app.client.waitForExist('[data-spectron="message"]')
        const alert = await app.client.getHTML("[data-spectron='message']")
        assert.equal(true, alert.includes("Successfully started token transaction."))

        await tokenPage.navigateToSection("Transactions");
        let lastTransaction = await tokenPage.returnLastTransaction()
        console.log(lastTransaction);

        // assert.equal(lastTransaction.date, transactionDate)
        // // assert.equal(lastTransaction.hour, transactionHour) // one minute earlier
        // assert.equal(lastTransaction.type, 'Sentto')
        // assert.equal(lastTransaction.address, 'tz1YXRdYAbNhwd5Vx1hhP2kt8JWAW6WD16Uq')
        // assert.equal(lastTransaction.amount, '1.000000\n')
        // assert.equal(lastTransaction.fee, '0.049975\n') // Fee is changing!
    })

    it.skip('set recipients to invalid one', async () => {
        await tokenPage.navigetToTokenSection('Token Sample');
        await tokenPage.navigateToSection('Send');
        await tokenPage.sendTokens({
            recipientAddress: " KT1HzQofKBxzfiKoMzGbkxBgjis2mWnCtbC2",
            send: false
        })
        await app.client.waitForExist(tokenPage.tokenRecipientInputAlert)

        const alertMessge = "This is a smart contract address. Please use interact with contracts button to transfer funds."
        // when manually: 'Addresses can only start tz1, tz2, tz3 or KT1'
        const alert = await app.client.getText(tokenPage.tokenRecipientInputAlert)
        assert.equal(alert, alertMessge)
    })

    it.skip('last transaction is not dublicated in transaction section - verify hours', async () => {
        await tokenPage.navigetToTokenSection('Token Sample');
        await tokenPage.navigateToSection("Transactions");
        const lastTransactionsHoursList = await tokenPage.app.client.getText('[data-spectron="transaction-date-hour"]');
        console.log(lastTransactionsHoursList)
        assert.equal(lastTransactionsHoursList[0] != lastTransactionsHoursList[1], true);
    })
});
