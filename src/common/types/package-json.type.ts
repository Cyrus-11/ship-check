// A validated projection of project metadata, not the shape of untrusted JSON.
export type PackageJson = {
  readonly name?: string;
  readonly scripts?: {
    readonly build?: string;
    readonly test?: string;
  };
};
