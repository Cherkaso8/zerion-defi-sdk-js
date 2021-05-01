import { useCallback, useEffect, useMemo, useState } from "react";
import type { Entry } from "../cache/Entry";
import type {
  CachedRequestOptions,
  Client,
  ConvenienceOptionsCached,
} from "../client";
import { client as defaultClient } from "../client";
import type { ResponsePayload } from "../requests/ResponsePayload";
import { getInitialState } from "../cache/Entry";
import { hasData } from "../cache/hasData";
import { SocketNamespace } from "../shared/SocketNamespace";

const emptyEntry = getInitialState<any>();

export type HookOptions<
  Namespace extends string = any,
  ScopeName extends string = any
> = ConvenienceOptionsCached<Namespace, ScopeName> & {
  client?: Client;
  keepStaleData?: boolean;
};

export function useSubscription<
  T,
  Namespace extends string = any,
  ScopeName extends string = any
>({
  keepStaleData,
  client: currentClient,
  ...hookOptions
}: HookOptions<Namespace, ScopeName>): Entry<ResponsePayload<T, ScopeName>> {
  const client = currentClient || defaultClient;
  const [entry, setEntry] = useState<Entry<
    ResponsePayload<T, ScopeName>
  > | null>(client.getFromCache(hookOptions));

  const guardedSetEntry = useCallback(
    (entry: null | Entry<ResponsePayload<T, ScopeName>>) => {
      setEntry(prevEntry => {
        if (!keepStaleData) {
          return entry;
        }
        if (!prevEntry) {
          return entry;
        }
        const newEntryHasData = entry ? hasData(entry.status) : false;
        const prevEntryHasData = hasData(prevEntry.status);
        if (!newEntryHasData && prevEntryHasData) {
          return {
            ...prevEntry,
            status: entry ? entry.status : prevEntry.status,
          };
        }
        return entry;
      });
    },
    [keepStaleData]
  );

  const { socketNamespace, namespace } = hookOptions as {
    socketNamespace?: SocketNamespace<Namespace>;
    namespace?: Namespace;
  };
  const options: CachedRequestOptions<T, Namespace, ScopeName> = useMemo(() => {
    const value = Object.assign(
      {
        method: hookOptions.method,
        cachePolicy: hookOptions.cachePolicy,
        body: hookOptions.body,
        getId: hookOptions.getId,
        mergeStrategy: hookOptions.mergeStrategy,
        onData: guardedSetEntry,
      },
      socketNamespace ? { socketNamespace } : null,
      namespace ? { namespace } : null
    );
    return value;
  }, [
    guardedSetEntry,
    hookOptions.body,
    hookOptions.cachePolicy,
    hookOptions.getId,
    hookOptions.mergeStrategy,
    hookOptions.method,
    namespace,
    socketNamespace,
  ]);

  useEffect(() => {
    guardedSetEntry(client.getFromCache(options));
    const { unsubscribe } = client.cachedSubscribe(options);
    return () => {
      console.log("effect cancel");
      unsubscribe();
    };
  }, [options, guardedSetEntry, client]);

  return entry || emptyEntry;
}
