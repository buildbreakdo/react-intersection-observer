/* eslint-env jest */
import 'intersection-observer';
import React from 'react';
import renderer from 'react-test-renderer';
import IntersectionObserver, { callback } from '../IntersectionObserver';
import IntersectionObserverContainer from '../IntersectionObserverContainer';

function mockUtilsFunctions() {
    const utils = require.requireActual('../utils');
    return {
        ...utils,
        isDOMTypeElement() {
            return true;
        },
    };
}

jest.mock('../utils', () => mockUtilsFunctions());

const noop = () => {};
const target = { nodeType: 1 };
const propTypes = IntersectionObserver.propTypes;

beforeAll(() => {
    IntersectionObserver.propTypes = {};
});

afterAll(() => {
    IntersectionObserver.propTypes = propTypes;
});

afterEach(() => {
    IntersectionObserverContainer.clear();
});

test('throws when the property children is not an only child', () => {
    global.spyOn(console, 'error');
    const component = (
        <IntersectionObserver onChange={noop}>
            <span />
            <span />
        </IntersectionObserver>
    );
    expect(() => renderer.create(component)).toThrowErrorMatchingSnapshot();
});

test('throws on mount if children is StatelessComponent in React 15', () => {
    global.spyOn(console, 'error');
    const { version } = React;
    const StatelessComponent = () => <span />;
    const component = (
        <IntersectionObserver onChange={noop}>
            <StatelessComponent />
        </IntersectionObserver>
    );

    React.version = '15.4.0';
    expect(() => renderer.create(component)).toThrowErrorMatchingSnapshot();
    React.version = version;
});

test('should call ref callback of children', () => {
    const spy = jest.fn();
    const component = (
        <IntersectionObserver onChange={noop}>
            <span ref={spy} />
        </IntersectionObserver>
    );

    renderer.create(component, { createNodeMock: () => target });

    expect(spy).toHaveBeenCalledWith(target);
});

test('options getter returns propTypes `root`, `rootMargin` and `threshold`', () => {
    const options = { root: { nodeType: 1 }, rootMargin: '50% 0%', threshold: [0, 1] };
    const component = (
        <IntersectionObserver onChange={noop} {...options}>
            <span />
        </IntersectionObserver>
    );

    const tree = renderer.create(component, { createNodeMock: () => target });

    expect(tree.getInstance().options).toEqual(options);
});

test("should save target in the observer targets' list on mount", () => {
    const component = (
        <IntersectionObserver onChange={noop}>
            <span />
        </IntersectionObserver>
    );
    const tree = renderer.create(component, { createNodeMock: () => target });
    const observer = tree.getInstance().observer;
    const retrieved = IntersectionObserverContainer.findElement({ target }, observer);

    expect(retrieved).toEqual(tree.getInstance());
});

test("should remove target from the observer targets' list on umount", () => {
    const component = (
        <IntersectionObserver onChange={noop}>
            <span />
        </IntersectionObserver>
    );
    const tree = renderer.create(component, { createNodeMock: () => target });
    const instance = tree.getInstance();
    const observer = instance.observer;
    tree.unmount();
    const retrieved = IntersectionObserverContainer.findElement({ target }, observer);

    expect(retrieved).toBeNull();
});

describe('update', () => {
    test('componentWillUpdate determines whether the observer should restart', () => {
        const component = (
            <IntersectionObserver onChange={noop}>
                <span />
            </IntersectionObserver>
        );
        const tree = renderer.create(component, { createNodeMock: () => target });
        const instance = tree.getInstance();

        const spy = jest.spyOn(instance, 'reobserve');

        tree.update(
            <IntersectionObserver onChange={noop} rootMargin="20% 10%">
                <span />
            </IntersectionObserver>,
        );
        expect(spy).toBeCalled();
    });

    test('should cleanup when tree reconciliation has led to a full rebuild', () => {
        const component = (
            <IntersectionObserver onChange={noop}>
                <span />
            </IntersectionObserver>
        );
        let called = false;
        const tree = renderer.create(component, {
            createNodeMock: () => {
                if (called) {
                    return target;
                }
                called = true;
                return Object.assign({ id: 2 }, target);
            },
        });
        const instance = tree.getInstance();
        const spy1 = jest.spyOn(instance, 'unobserve');
        const spy2 = jest.spyOn(instance, 'observe');

        tree.update(
            <IntersectionObserver onChange={noop}>
                <span />
            </IntersectionObserver>,
        );

        tree.update(
            <IntersectionObserver onChange={noop} rootMargin="1%">
                <div />
            </IntersectionObserver>,
        );

        expect(spy1).toHaveBeenCalledTimes(2);
        expect(spy2).toHaveBeenCalledTimes(1);
        expect(instance.target).toBe(target);
    });

    test('should reobserve with new root, rootMargin and/or threshold props', () => {
        const winElement = Object.assign({ id: 'window' }, target);
        const docElement = Object.assign({ id: 'document' }, target);
        const initialProps = {
            onChange: noop,
            root: winElement,
            rootMargin: '10% 20%',
            threshold: 0.5,
        };
        const children = <span />;
        const component = <IntersectionObserver {...initialProps}>{children}</IntersectionObserver>;
        const instance = renderer.create(component, { createNodeMock: () => target }).getInstance();
        const nextProps = { ...initialProps, children };

        instance.componentWillUpdate(nextProps);
        expect(instance.shouldResetObserver).toBeFalsy();

        instance.componentWillUpdate({
            ...nextProps,
            children: <div />,
        });
        expect(instance.shouldResetObserver).toBeFalsy();

        instance.componentWillUpdate({
            ...nextProps,
            root: docElement,
        });
        expect(instance.shouldResetObserver).toBeTruthy();

        instance.componentWillUpdate({
            ...nextProps,
            root: winElement,
        });
        expect(instance.shouldResetObserver).toBeFalsy();

        instance.componentWillUpdate({
            ...nextProps,
            root: winElement,
            rootMargin: '20% 10%',
        });
        expect(instance.shouldResetObserver).toBeTruthy();

        instance.componentWillUpdate({
            ...nextProps,
            rootMargin: '20% 10%',
        });
        expect(instance.shouldResetObserver).toBeTruthy();

        instance.componentWillUpdate({
            ...nextProps,
            threshold: [0.5, 1],
        });
        expect(instance.shouldResetObserver).toBeTruthy();

        instance.componentWillUpdate({
            ...nextProps,
            threshold: [0, 0.25, 0.5, 0.75, 1],
        });
        expect(instance.shouldResetObserver).toBeTruthy();

        instance.componentWillUpdate({
            ...nextProps,
            threshold: 1,
        });
        expect(instance.shouldResetObserver).toBeTruthy();
    });
});

describe('callback', () => {
    test('should call propType onChange for each of the changes', () => {
        const spy = jest.fn();
        const component = (
            <IntersectionObserver onChange={spy}>
                <span />
            </IntersectionObserver>
        );
        const target1 = Object.assign({ id: 1 }, target);
        const target2 = Object.assign({ id: 2 }, target);
        const instance = renderer.create(component, { createNodeMock: () => target1 }).getInstance();
        renderer.create(React.cloneElement(component), { createNodeMock: () => target2 });

        expect(IntersectionObserverContainer.count()).toBe(1);

        const boundingClientRect = {};
        const intersectionRect = {};
        const entry1 = new IntersectionObserverEntry({
            target: target1,
            boundingClientRect,
            intersectionRect,
        });
        const entry2 = new IntersectionObserverEntry({
            target: target2,
            boundingClientRect,
            intersectionRect,
        });

        callback([entry1, entry2], instance.observer);

        expect(spy.mock.calls[0][0]).toBe(entry1);
        expect(spy.mock.calls[1][0]).toBe(entry2);
    });
});

describe('handleChange', () => {
    test('should throw with `onlyOnce` if entry lacks `isIntersecting`', () => {
        const component = (
            <IntersectionObserver onChange={noop} onlyOnce>
                <span />
            </IntersectionObserver>
        );
        const instance = renderer.create(component, { createNodeMock: () => target }).getInstance();
        const boundingClientRect = {};
        const intersectionRect = {};
        const entry = new IntersectionObserverEntry({
            target,
            boundingClientRect,
            intersectionRect,
        });
        delete entry.isIntersecting;

        expect(() => instance.handleChange(entry)).toThrowErrorMatchingSnapshot();
    });

    test('should unobserve with `onlyOnce` if `isIntersecting` is true', () => {
        const component = (
            <IntersectionObserver onChange={noop} onlyOnce>
                <span />
            </IntersectionObserver>
        );
        const instance = renderer.create(component, { createNodeMock: () => target }).getInstance();
        const spy = jest.spyOn(instance, 'unobserve');
        const boundingClientRect = {};
        const intersectionRect = {};
        const entry = new IntersectionObserverEntry({
            target,
            boundingClientRect,
            intersectionRect,
        });
        entry.isIntersecting = true;

        instance.handleChange(entry);

        expect(spy).toBeCalled();
    });

    test('should not unobserve with `onlyOnce` if `isIntersecting` is false', () => {
        const component = (
            <IntersectionObserver onChange={noop} onlyOnce>
                <span />
            </IntersectionObserver>
        );
        const instance = renderer.create(component, { createNodeMock: () => target }).getInstance();
        const spy = jest.spyOn(instance, 'unobserve');
        const boundingClientRect = {};
        const intersectionRect = {};
        const entry = new IntersectionObserverEntry({
            target,
            boundingClientRect,
            intersectionRect,
        });
        entry.isIntersecting = false;

        instance.handleChange(entry);

        expect(spy).not.toBeCalled();
    });

    describe('disabled', () => {
        test('should not observe if disabled', () => {
            const component = (
                <IntersectionObserver onChange={noop} disabled>
                    <span />
                </IntersectionObserver>
            );
            const spy = jest.spyOn(IntersectionObserverContainer, 'observe');
            renderer.create(component, { createNodeMock: () => target });

            expect(spy).not.toBeCalled();
        });

        test('should observe if not disabled', () => {
            const component = (
                <IntersectionObserver onChange={noop}>
                    <span />
                </IntersectionObserver>
            );
            const spy = jest.spyOn(IntersectionObserverContainer, 'observe');
            renderer.create(component, { createNodeMock: () => target }).getInstance();

            expect(spy).toBeCalled();
        });

        test('should observe if no longer disabled', () => {
            const component = (
                <IntersectionObserver onChange={noop} disabled>
                    <span />
                </IntersectionObserver>
            );
            const tree = renderer.create(component, { createNodeMock: () => target });
            const instance = tree.getInstance();
            const spy = jest.spyOn(instance, 'observe');

            tree.update(
                <IntersectionObserver onChange={noop}>
                    <span />
                </IntersectionObserver>,
            );

            expect(spy).toBeCalled();
        });

        test('should unobserve if disabled', () => {
            const component = (
                <IntersectionObserver onChange={noop}>
                    <span />
                </IntersectionObserver>
            );
            const tree = renderer.create(component, { createNodeMock: () => target });
            const instance = tree.getInstance();
            const spy1 = jest.spyOn(instance, 'unobserve');
            const spy2 = jest.spyOn(instance, 'observe');

            tree.update(
                <IntersectionObserver onChange={noop} disabled>
                    <span />
                </IntersectionObserver>,
            );

            expect(spy1).toBeCalled();
            expect(spy2).not.toBeCalled();
        });
    });
});
