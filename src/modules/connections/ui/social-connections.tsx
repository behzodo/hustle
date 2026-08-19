"use client";

import { useMutation } from "convex/react";
import { FacebookLogoIcon, InstagramLogoIcon } from "@phosphor-icons/react";

import { api } from "@/../convex/_generated/api";

import { NangoConnection } from "./nango-connection";

/**
 * Instagram and Facebook.
 *
 * Worth being exact about what these are for, because the obvious assumption
 * is wrong and it is the kind of wrong that is only discovered after building
 * a whole channel on it: neither can start a conversation. Meta's messaging
 * APIs let a business reply to somebody who messaged it, inside the window
 * that opens when they do. There is no cold DM. An attempt is refused at the
 * API, not merely against the rules.
 *
 * They earn their place anyway. A good share of these businesses have a
 * Facebook page instead of a website — it is why they were picked — and when
 * one of them sees the site and answers on Instagram rather than by email,
 * that reply should land in the same inbox as everything else and be
 * answerable from it. Inbound, not outbound.
 */

export const InstagramConnection = ({ connected }: { connected?: boolean }) => {
  const setConnections = useMutation(api.profiles.setConnections);

  return (
    <NangoConnection
      integration="instagram"
      logo={<InstagramLogoIcon className="size-6 text-[#E1306C]" weight="fill" />}
      name="Instagram"
      pitch="Answer businesses that reply on Instagram without leaving the inbox. Cannot start a conversation — Meta does not allow it."
      connectedNote="Instagram replies land in the pitch inbox and can be answered there."
      connected={connected}
      onConnected={(connectionId) =>
        setConnections({ instagramConnectionId: connectionId })
      }
    />
  );
};

export const FacebookConnection = ({ connected }: { connected?: boolean }) => {
  const setConnections = useMutation(api.profiles.setConnections);

  return (
    <NangoConnection
      integration="facebook"
      logo={<FacebookLogoIcon className="size-6 text-[#1877F2]" weight="fill" />}
      name="Facebook"
      pitch="The same for your Page's inbox. Half these businesses have a Facebook page instead of a website."
      connectedNote="Page messages land in the pitch inbox and can be answered there."
      connected={connected}
      onConnected={(connectionId) =>
        setConnections({ facebookConnectionId: connectionId })
      }
    />
  );
};
