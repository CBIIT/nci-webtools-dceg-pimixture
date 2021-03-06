const should = require('chai').should();

describe('Test environmental Variables', function() {
    it('Should specify the website in the TEST_WEBSITE environmental variable', function() {
        const value = process.env.TEST_WEBSITE;
        should.exist(value);
        value.should.be.a('string');
        value.should.not.be.empty;
    });
});