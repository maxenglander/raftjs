import { expect } from 'chai';
import sinon from 'sinon';

import { createElectionTimer } from './election-timer';

describe('timer', function() {
    let timer,
        timeout,
        timeoutChooser;

    afterEach(function() {
        timer.stop();
    });

    beforeEach(function() {
        timeout = Math.floor(Math.random() * 5000);

        timeoutChooser = {
            choose: sinon.fake.returns(timeout)
        };

        timer = createElectionTimer({
            timeoutChooser
        });
    });

    context('when it is stopped', function() {

        it('is not running', function() {
            expect(timer.running).to.be.false;
        });

        context('and #start is called', function() {
            let onStarted;

            beforeEach(function() {
                onStarted = sinon.fake();
                timer.on('started', onStarted);
                timer.start();
            });

            it('gets a new timeout', function() {
                expect(timeoutChooser.choose.calledOnce).to.be.true;
            });

            it('starts the timer', function() {
                expect(onStarted.calledOnce).to.be.true;
            });

            it('eventually times out', function(done) {
                this.timeout(timeout + 1000);

                let invokedDone = false;

                function wrappedDone(message) {
                    if(!invokedDone) {
                        done(message);
                        invokedDone = true;
                    }
                }

                setTimeout(function() {
                    wrappedDone('Should have timed out');
                }, timeout);

                timer.on('timeout', function() {
                    wrappedDone(null);
                });
            });
        });

        context('and #stop is called', function() {
            let onStopped;

            beforeEach(function() {
                onStopped = sinon.fake();
                timer.on('stopped', onStopped);
                timer.stop();
            });

            it('does not stop the the timer', function() {
                expect(onStopped.calledOnce).to.be.false;
            });
        });
    });

    context('when it is started', function() {
        beforeEach(function() {
            timer.start();
        });

        it('is running', function() {
            expect(timer.running).to.be.true;
        });

        context('and #start is called', function() {
            let onStarted;

            beforeEach(function() {
                onStarted = sinon.fake();
                timer.on('started', onStarted);
                timer.start();
            });

            it('does not start the timer', function() {
                expect(onStarted.calledOnce).to.be.false;
            });
        });

        context('and #stop is called', function() {
            let onStopped;

            beforeEach(function() {
                onStopped = sinon.fake();
                timer.on('stopped', onStopped);
                timer.stop();
            });

            it('stops the timer', function() {
                expect(onStopped.calledOnce).to.be.true;
            });

            it('never times out', function(done) {
                this.timeout(timeout + 1000);
                setTimeout(done, timeout);
                timer.on('timeout', function() {
                    done('Should not have timed out');
                });
            });
        });
    });
});
