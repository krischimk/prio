-- Serverinterner verschlüsselter OAuth-Tresor. Auch anonyme Verbindungsstarts
-- benötigen eine frische HMAC-Attestation; kein Service-Role-Zugang im Worker.
begin;
create or replace function private.mcp_vault(p_request text,p_proof text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare secret text; body jsonb; data jsonb; token private.mcp_oauth_tokens; replacement private.mcp_oauth_tokens;
  operation text; grant_active boolean;
begin
  select command_key into secret from private.mcp_settings where singleton;
  if secret is null or octet_length(p_request)>100000 or p_proof !~ '^[0-9a-f]{64}$'
    or encode(extensions.hmac(convert_to(p_request,'UTF8'),convert_to(secret,'UTF8'),'sha256'),'hex') is distinct from p_proof then
    raise exception 'Ungültige Tresorbestätigung.' using errcode='42501';
  end if;
  body:=p_request::jsonb; data:=body->'data'; operation:=body->>'operation';
  if body->>'purpose' is distinct from 'prio-mcp-vault-v1' or body->>'resource' is distinct from (select resource from private.mcp_settings where singleton)
    or body->>'issued_at' is null or abs(extract(epoch from clock_timestamp())-(body->>'issued_at')::numeric)>60 then
    raise exception 'Ungültiger Tresorauftrag.' using errcode='42501';
  end if;
  if operation='client_put' then
    perform pg_advisory_xact_lock(hashtextextended('prio:mcp:registration',0));
    if (select count(*) from private.mcp_oauth_clients where created_at>clock_timestamp()-interval '1 day')>=100 then
      raise exception 'Registrierungslimit erreicht.' using errcode='54000';
    end if;
    insert into private.mcp_oauth_clients(id,secret_cipher,metadata) values((data->>'id')::uuid,data->>'secret_cipher',data->'metadata');
    return data->'metadata';
  elsif operation='client_get' then
    return (select jsonb_build_object('id',id,'secret_cipher',secret_cipher,'metadata',metadata) from private.mcp_oauth_clients where id=(data->>'id')::uuid);
  elsif operation='token_put' then
    if not exists(select 1 from private.mcp_connections c where c.user_id=(data->>'user_id')::uuid and c.client_id=(data->>'client_id')::uuid and c.revoked_at is null)
      or not exists(select 1 from auth.sessions s where s.id=(data->>'session_id')::uuid and s.user_id=(data->>'user_id')::uuid and s.oauth_client_id=(data->>'client_id')::uuid) then
      raise exception 'Verbindung ist nicht freigegeben.' using errcode='42501';
    end if;
    if data->>'old_refresh_hash' is not null then
      select * into token from private.mcp_oauth_tokens where refresh_hash=data->>'old_refresh_hash' for update;
      if not found or token.used_at is not null or token.lease is distinct from (data->>'lease')::uuid
        or token.client_id is distinct from (data->>'client_id')::uuid or token.user_id is distinct from (data->>'user_id')::uuid then
        raise exception 'Tokenrotation wurde bereits übernommen.' using errcode='40001';
      end if;
    end if;
    insert into private.mcp_oauth_tokens(access_hash,refresh_hash,bundle_cipher,user_id,client_id,session_id,expires_at)
      values(data->>'access_hash',data->>'refresh_hash',data->>'bundle_cipher',(data->>'user_id')::uuid,(data->>'client_id')::uuid,(data->>'session_id')::uuid,(data->>'expires_at')::timestamptz);
    if token.refresh_hash is not null then update private.mcp_oauth_tokens set used_at=clock_timestamp(),replacement=data->>'access_hash',lease=null,locked_until=null where access_hash=token.access_hash; end if;
    return jsonb_build_object('stored',true);
  elsif operation in ('access_get','refresh_get','refresh_release') then
    if operation='access_get' then select * into token from private.mcp_oauth_tokens where access_hash=data->>'hash';
    else select * into token from private.mcp_oauth_tokens where refresh_hash=data->>'hash' for update; end if;
    if not found then return null; end if;
    select exists(select 1 from private.mcp_connections c where c.user_id=token.user_id and c.client_id=token.client_id and c.revoked_at is null
      and token.created_at>=c.approved_at) into grant_active;
    if not grant_active then return null; end if;
    if operation='refresh_release' then
      update private.mcp_oauth_tokens set lease=null,locked_until=null where access_hash=token.access_hash and lease=(data->>'lease')::uuid;
      return null;
    elsif operation='access_get' then
      if token.expires_at<=clock_timestamp() then return null; end if;
      return jsonb_build_object('cipher',token.bundle_cipher);
    end if;
    if token.client_id is distinct from (data->>'client_id')::uuid or token.refresh_expires_at<=clock_timestamp() then return null; end if;
    if token.used_at is not null then
      if token.used_at<clock_timestamp()-interval '30 seconds' then return null; end if;
      select * into replacement from private.mcp_oauth_tokens where access_hash=token.replacement;
      return jsonb_build_object('cipher',replacement.bundle_cipher,'replay',true);
    end if;
    if token.locked_until>clock_timestamp() then return jsonb_build_object('busy',true); end if;
    update private.mcp_oauth_tokens set lease=(data->>'lease')::uuid,locked_until=clock_timestamp()+interval '30 seconds' where access_hash=token.access_hash;
    return jsonb_build_object('cipher',token.bundle_cipher,'replay',false);
  end if;
  raise exception 'Unbekannter Tresorauftrag.' using errcode='22023';
end $$;
revoke all on function private.mcp_vault(text,text) from public,anon,authenticated;
grant execute on function private.mcp_vault(text,text) to anon,authenticated;
create or replace function public.mcp_vault(p_request text,p_proof text) returns jsonb
language sql security invoker set search_path='' as $$ select private.mcp_vault(p_request,p_proof) $$;
revoke all on function public.mcp_vault(text,text) from public,anon,authenticated;
grant execute on function public.mcp_vault(text,text) to anon,authenticated;
create or replace function private.mcp_prune_tokens() returns void
language sql security definer set search_path='' as $$
  delete from private.mcp_oauth_tokens t where
    t.expires_at<clock_timestamp() and (t.used_at<clock_timestamp()-interval '30 seconds' or t.refresh_expires_at<clock_timestamp())
    or not exists(select 1 from private.mcp_connections c where c.user_id=t.user_id and c.client_id=t.client_id and c.revoked_at is null and t.created_at>=c.approved_at);
$$;
revoke all on function private.mcp_prune_tokens() from public,anon,authenticated;
select cron.schedule('prio-prune-mcp-tokens','15 3 * * *',$job$select private.mcp_prune_tokens();$job$);
notify pgrst,'reload schema';
commit;
